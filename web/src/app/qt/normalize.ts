import { isKnownBookId } from '@/i18n/books';
import {
  KNOWN_AVAILABILITY_STATUSES,
  type QtAvailabilityStatus,
  type QtOfficialUrlKind,
  type QtProvider,
  type QtTodayResponse,
  type QtVerseRange,
  type QtViewStatus,
} from './types';

/** 응답 전체를 쓸 수 없을 때(스키마 버전 불일치, 형식 오류). QT 영역만 오류 화면이 된다. */
export class QtResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QtResponseError';
  }
}

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const posInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isHttps(url: string | null): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseRange(v: unknown): QtVerseRange | null {
  if (!isRec(v) || !isRec(v.start) || !isRec(v.end)) return null;
  const { bookId, start, end } = v;
  if (typeof bookId !== 'string' || !isKnownBookId(bookId)) return null;
  if (![start.chapter, start.verse, end.chapter, end.verse].every(posInt)) return null;
  const s = { chapter: start.chapter as number, verse: start.verse as number };
  const e = { chapter: end.chapter as number, verse: end.verse as number };
  if (s.chapter > e.chapter || (s.chapter === e.chapter && s.verse > e.verse)) return null;
  return { bookId, start: s, end: e };
}

function parsePassage(v: unknown): { ranges: QtVerseRange[] } | null {
  if (!isRec(v) || !Array.isArray(v.ranges) || v.ranges.length === 0) return null;
  const ranges: QtVerseRange[] = [];
  for (const r of v.ranges) {
    const parsed = parseRange(r);
    if (!parsed) return null; // 일부만 믿지 않는다. 범위를 추정하지 않는다.
    ranges.push(parsed);
  }
  return { ranges };
}

function parseStatus(v: unknown): QtViewStatus {
  return (KNOWN_AVAILABILITY_STATUSES as readonly unknown[]).includes(v)
    ? (v as QtAvailabilityStatus)
    : 'UNKNOWN';
}

function parseKind(v: unknown): QtOfficialUrlKind | null {
  return v === 'date-specific' || v === 'today-page' ? v : null;
}

function parseNotice(v: unknown): QtProvider['notice'] {
  if (!isRec(v)) return null;
  const ko = str(v.ko);
  const en = str(v.en);
  return ko || en ? { ...(ko ? { ko } : {}), ...(en ? { en } : {}) } : null;
}

function parseProvider(v: unknown): QtProvider | null {
  if (!isRec(v)) return null;
  const providerId = str(v.providerId);
  if (!providerId) return null;

  const name = isRec(v.providerName) ? v.providerName : {};
  const providerName = {
    ko: str(name.ko) ?? str(name.en) ?? providerId,
    en: str(name.en) ?? str(name.ko) ?? providerId,
  };

  let status = parseStatus(v.availabilityStatus);
  let reasonCode = str(v.reasonCode);
  // 범위는 RANGE_CONFIRMED이고 유효할 때만 인정한다. 그 외 상태의 passage는 버린다.
  let passage: QtProvider['passage'] = null;
  if (status === 'RANGE_CONFIRMED') {
    passage = parsePassage(v.passage);
    if (!passage) {
      status = 'RANGE_UNAVAILABLE';
      reasonCode = 'INVALID_REFERENCE';
    }
  }

  const officialUrl = str(v.officialUrl);
  const providerDate = str(v.providerDate);

  return {
    providerId,
    providerName,
    providerTimeZone: str(v.providerTimeZone) ?? 'Asia/Seoul',
    providerDate: providerDate && ISO_DATE.test(providerDate) ? providerDate : null,
    availabilityStatus: status,
    reasonCode: status === 'RANGE_CONFIRMED' ? null : reasonCode,
    passage,
    displayReference: str(v.displayReference),
    officialUrl: isHttps(officialUrl) ? officialUrl : null,
    officialUrlKind: parseKind(v.officialUrlKind),
    verifiedAt: str(v.verifiedAt),
    sourceVersion: str(v.sourceVersion) ?? '',
    notice: parseNotice(v.notice),
  };
}

/** 서버(또는 mock) JSON을 화면 타입으로 정규화한다. 성경 본문·해설 필드는 읽지도 않는다. */
export function normalizeQtToday(json: unknown): QtTodayResponse {
  if (!isRec(json)) throw new QtResponseError('QT 응답이 객체가 아닙니다.');
  if (json.schemaVersion !== '1') {
    throw new QtResponseError(`지원하지 않는 QT 스키마 버전입니다: ${String(json.schemaVersion)}`);
  }
  if (!Array.isArray(json.providers)) throw new QtResponseError('QT 응답에 providers가 없습니다.');

  const providers = json.providers.map(parseProvider).filter((p): p is QtProvider => p !== null);
  if (providers.length === 0) throw new QtResponseError('QT 응답에 사용할 수 있는 제공처가 없습니다.');

  return {
    schemaVersion: '1',
    generatedAt: str(json.generatedAt) ?? '',
    providers,
  };
}
