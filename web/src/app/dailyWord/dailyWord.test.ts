import { describe, expect, it, vi } from 'vitest';
import { createDailyWordLoader, loadDailyWord } from './loader';
import { validateDailyWord } from './validate';

// Test-only fixture. Strings explicitly state that they are not Scripture and are never imported by app code.
const testOnlyPayload = (date = '2026-09-26') => ({
  schemaVersion: '1',
  date,
  timeZone: 'Asia/Seoul',
  contentVersion: 'test-only-fixture-v1',
  oldTestament: {
    reference: { bookId: 'GEN', chapter: 1, verse: 1 },
    translationId: 'test-only-not-a-translation',
    textLanguage: 'ko',
    text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT AN EXPLANATION]', kind: 'editorial', language: 'ko' },
    source: { name: 'Test fixture only', url: 'https://example.invalid/test-fixture' },
  },
  newTestament: {
    reference: { bookId: 'MAT', chapter: 1, verse: 1 },
    translationId: 'test-only-not-a-translation',
    textLanguage: 'ko',
    text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT AN EXPLANATION]', kind: 'editorial', language: 'ko' },
    source: { name: 'Test fixture only', url: 'https://example.invalid/test-fixture' },
  },
});

const validateTestOnly = (payload: unknown, date?: string) =>
  validateDailyWord(payload, date, { allowTestOnlyTranslations: true });

describe('daily word contract', () => {
  it('accepts a well-formed test-only payload and preserves its date', () => {
    expect(validateTestOnly(testOnlyPayload(), '2026-09-26').date).toBe('2026-09-26');
  });

  it.each(['2026-02-29', '2026-13-01', 'yesterday'])('rejects invalid requested date %s', (date) => {
    expect(() => validateTestOnly(testOnlyPayload(), date)).toThrow();
  });

  it('rejects date mismatch and non-Seoul time zone', () => {
    expect(() => validateTestOnly(testOnlyPayload('2026-09-25'), '2026-09-26')).toThrow(/does not match/);
    expect(() => validateTestOnly({ ...testOnlyPayload(), timeZone: 'UTC' })).toThrow(/Asia\/Seoul/);
  });

  it('checks testament using the app book catalog without guessing verse counts', () => {
    const wrongBook = testOnlyPayload();
    wrongBook.oldTestament.reference.bookId = 'MAT';
    expect(() => validateTestOnly(wrongBook)).toThrow(/wrong testament/);

    const unknown = testOnlyPayload();
    unknown.newTestament.reference.bookId = 'ZZZ';
    expect(() => validateTestOnly(unknown)).toThrow(/supported Bible catalog/);
  });

  it('rejects ranges, empty metadata, and non-HTTP source URLs', () => {
    const invalidReference = testOnlyPayload();
    Object.assign(invalidReference.oldTestament.reference, { endVerse: 2 });
    expect(() => validateTestOnly(invalidReference)).toThrow(/exactly one verse/);

    const emptyText = testOnlyPayload();
    emptyText.newTestament.text = '   ';
    expect(() => validateTestOnly(emptyText)).toThrow(/textLanguage, and verse text/);

    const badUrl = testOnlyPayload();
    badUrl.oldTestament.source.url = 'javascript:alert(1)';
    expect(() => validateTestOnly(badUrl)).toThrow(/HTTP\(S\)/);
  });

  it('production validation rejects test fixtures but accepts the selected 1961 Korean Revised Version', () => {
    expect(() => validateDailyWord(testOnlyPayload())).toThrow(/not approved/);
    const selectedKorRv = testOnlyPayload();
    selectedKorRv.oldTestament.translationId = 'kor-rv-1961';
    selectedKorRv.newTestament.translationId = 'kor-rv-1961';
    expect(validateDailyWord(selectedKorRv).oldTestament.translationId).toBe('kor-rv-1961');
  });
});

describe('date-keyed static loader', () => {
  it('requests the exact date artifact and validates the returned date', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(testOnlyPayload()), { status: 200 }));
    const result = await createDailyWordLoader({ basePath: '/assets/daily-word/', fetcher, allowTestOnlyTranslations: true })('2026-09-26');
    expect(fetcher).toHaveBeenCalledWith('/assets/daily-word/2026-09-26.json', expect.anything());
    expect(result?.date).toBe('2026-09-26');
  });

  it.each([403, 404])('does not fallback to another date when exact-date content is missing (HTTP %i)', async (status) => {
    const fetcher = vi.fn(async () => new Response('', { status }));
    await expect(loadDailyWord('2026-09-26', fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/daily-word/2026-09-26.json', expect.anything());
  });

  it('rejects mismatched payload dates, invalid input dates, and HTTP failures', async () => {
    const mismatch = createDailyWordLoader({ fetcher: async () => new Response(JSON.stringify(testOnlyPayload('2026-09-25'))), allowTestOnlyTranslations: true });
    await expect(mismatch('2026-09-26')).rejects.toThrow(/does not match/);

    const fetcher = vi.fn();
    await expect(createDailyWordLoader({ fetcher })('2026-02-30')).rejects.toThrow(/real YYYY-MM-DD/);
    expect(fetcher).not.toHaveBeenCalled();

    const unavailable = createDailyWordLoader({ fetcher: async () => new Response('', { status: 503 }) });
    await expect(unavailable('2026-09-26')).rejects.toThrow(/503/);
  });
});
