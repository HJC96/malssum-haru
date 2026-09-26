import { BOOKS, isKnownBookId } from '@/i18n/books';
import type { DailyWordContent, DailyWordEntry, DailyWordTestament } from './types';
import { approvedTranslation } from './translations';

export interface DailyWordValidationOptions {
  /** Explicitly for unit tests only; never set by the production loader. */
  allowTestOnlyTranslations?: boolean;
}

export class DailyWordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyWordValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function validatePassage(value: unknown, key: DailyWordTestament, options: DailyWordValidationOptions): DailyWordEntry {
  if (!isRecord(value)) throw new DailyWordValidationError(`${key} must be an object`);
  if (!hasOnlyKeys(value, ['reference', 'translationId', 'textLanguage', 'text', 'explanation', 'source'])) {
    throw new DailyWordValidationError(`${key} contains unsupported fields`);
  }
  const reference = value.reference;
  if (!isRecord(reference)) throw new DailyWordValidationError(`${key}.reference must be an object`);
  if (!hasOnlyKeys(reference, ['bookId', 'chapter', 'verse'])) {
    throw new DailyWordValidationError(`${key}.reference must identify exactly one verse`);
  }
  const { bookId, chapter, verse } = reference;
  if (typeof bookId !== 'string' || !isKnownBookId(bookId)) {
    throw new DailyWordValidationError(`${key}.reference.bookId is not in the supported Bible catalog`);
  }
  if (!Number.isInteger(chapter) || (chapter as number) < 1 || !Number.isInteger(verse) || (verse as number) < 1) {
    throw new DailyWordValidationError(`${key}.reference must identify one positive chapter and verse`);
  }
  const catalogEntry = BOOKS.find((book) => book.bookId === bookId);
  const expectedTestament = key === 'oldTestament' ? 'OT' : 'NT';
  if (!catalogEntry || catalogEntry.testament !== expectedTestament) {
    throw new DailyWordValidationError(`${key}.reference.bookId belongs to the wrong testament`);
  }

  const explanation = value.explanation;
  if (isRecord(explanation) && !hasOnlyKeys(explanation, ['text', 'kind', 'language'])) {
    throw new DailyWordValidationError(`${key}.explanation contains unsupported fields`);
  }
  if (!isRecord(explanation) || !nonEmptyString(explanation.text) || (explanation.kind !== 'reviewed' && explanation.kind !== 'editorial') || (explanation.language !== 'ko' && explanation.language !== 'en')) {
    throw new DailyWordValidationError(`${key}.explanation requires non-empty text, kind, and language`);
  }
  const source = value.source;
  if (isRecord(source) && !hasOnlyKeys(source, ['name', 'url'])) {
    throw new DailyWordValidationError(`${key}.source contains unsupported fields`);
  }
  if (!isRecord(source) || !nonEmptyString(source.name) || !nonEmptyString(source.url)) {
    throw new DailyWordValidationError(`${key}.source requires a name and URL`);
  }
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source.url);
  } catch {
    throw new DailyWordValidationError(`${key}.source.url must be an absolute HTTP(S) URL`);
  }
  if (sourceUrl.protocol !== 'https:' && sourceUrl.protocol !== 'http:') {
    throw new DailyWordValidationError(`${key}.source.url must use HTTP(S)`);
  }
  if (!nonEmptyString(value.translationId) || (value.textLanguage !== 'ko' && value.textLanguage !== 'en') || !nonEmptyString(value.text)) {
    throw new DailyWordValidationError(`${key} requires translationId, supported textLanguage, and verse text`);
  }
  const approved = approvedTranslation(value.translationId);
  const testOnly = options.allowTestOnlyTranslations === true && value.translationId.startsWith('test-only-');
  if (!approved && !testOnly) {
    throw new DailyWordValidationError(`${key}.translationId is not approved for production display`);
  }
  if (approved && approved.language !== value.textLanguage) {
    throw new DailyWordValidationError(`${key}.textLanguage does not match the approved translation`);
  }

  return value as unknown as DailyWordEntry;
}

/** Validate content shape, date, and OT/NT assignment. Does not claim the verse exists in a specific translation. */
export function validateDailyWord(value: unknown, requestedDate?: string, options: DailyWordValidationOptions = {}): DailyWordContent {
  if (!isRecord(value)) throw new DailyWordValidationError('daily word must be an object');
  if (!hasOnlyKeys(value, ['schemaVersion', 'date', 'timeZone', 'contentVersion', 'oldTestament', 'newTestament'])) {
    throw new DailyWordValidationError('daily word contains unsupported fields');
  }
  if (value.schemaVersion !== '1') throw new DailyWordValidationError('schemaVersion must be "1"');
  if (!isIsoDate(value.date)) throw new DailyWordValidationError('date must be a real YYYY-MM-DD date');
  if (requestedDate !== undefined) {
    if (!isIsoDate(requestedDate)) throw new DailyWordValidationError('requested date must be a real YYYY-MM-DD date');
    if (value.date !== requestedDate) throw new DailyWordValidationError('content date does not match requested date');
  }
  if (value.timeZone !== 'Asia/Seoul') throw new DailyWordValidationError('timeZone must be Asia/Seoul');
  if (!nonEmptyString(value.contentVersion)) throw new DailyWordValidationError('contentVersion must be non-empty');

  const oldTestament = validatePassage(value.oldTestament, 'oldTestament', options);
  const newTestament = validatePassage(value.newTestament, 'newTestament', options);
  return { ...value, oldTestament, newTestament } as DailyWordContent;
}
