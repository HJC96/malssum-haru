import { BOOKS, BOOK_IDS, bookName, isKnownBookId } from './books';
import { formatIsoDate, formatPassageText, formatRangeText, localIsoDate } from './format';
import { detectLang } from './lang';
import { MESSAGES, translate } from './messages';

describe('책 이름 표(66권)', () => {
  it('66권이고 구약 39·신약 27이다', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.filter((b) => b.testament === 'OT')).toHaveLength(39);
    expect(BOOKS.filter((b) => b.testament === 'NT')).toHaveLength(27);
    expect(BOOKS[0]?.bookId).toBe('GEN');
    expect(BOOKS[65]?.bookId).toBe('REV');
  });

  it('bookId는 USFM 3글자 대문자이고 중복이 없다', () => {
    expect(BOOK_IDS.every((id) => /^[0-9A-Z]{3}$/.test(id))).toBe(true);
    expect(new Set(BOOK_IDS).size).toBe(66);
  });

  it('한국어·영어 이름이 모두 있고 각 언어 안에서 유일하다', () => {
    for (const lang of ['ko', 'en'] as const) {
      const names = BOOKS.map((b) => b[lang]);
      expect(names.every((n) => n.trim().length > 0)).toBe(true);
      expect(new Set(names).size).toBe(66);
    }
  });

  it('bookId로 이름을 찾고, 모르는 id는 지어내지 않고 id를 돌려준다', () => {
    expect(bookName('JHN', 'ko')).toBe('요한복음');
    expect(bookName('JHN', 'en')).toBe('John');
    expect(bookName('SNG', 'en')).toBe('Song of Solomon');
    expect(bookName('XXX', 'ko')).toBe('XXX');
    expect(isKnownBookId('REV')).toBe(true);
    expect(isKnownBookId('rev')).toBe(false);
  });
});

describe('UI 문자열 딕셔너리', () => {
  it('한국어·영어 키가 같고 값이 비어 있지 않다', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.ko).sort());
    for (const lang of ['ko', 'en'] as const) {
      expect(Object.values(MESSAGES[lang]).every((v) => v.trim().length > 0)).toBe(true);
    }
  });

  it('두 언어의 자리표시자가 같다', () => {
    const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(MESSAGES.ko) as Array<keyof typeof MESSAGES.ko>) {
      expect(holders(MESSAGES.en[key])).toEqual(holders(MESSAGES.ko[key]));
    }
  });

  it('자리표시자를 채우고, 값이 없으면 그대로 둔다', () => {
    expect(translate('ko', 'qt.link.go', { provider: '매일성경' })).toBe('매일성경 공식 페이지로 이동');
    expect(translate('en', 'qt.link.go')).toBe('Go to {provider} official page');
  });
});

describe('장절 표시', () => {
  const jhn = (s: [number, number], e: [number, number]) => ({
    bookId: 'JHN',
    start: { chapter: s[0], verse: s[1] },
    end: { chapter: e[0], verse: e[1] },
  });

  it('한 장 안의 범위', () => {
    expect(formatRangeText(jhn([3, 1], [3, 21]), 'ko')).toBe('요한복음 3:1–21');
    expect(formatRangeText(jhn([3, 1], [3, 21]), 'en')).toBe('John 3:1–21');
  });

  it('여러 장에 걸친 범위와 한 절', () => {
    expect(formatRangeText(jhn([3, 1], [4, 54]), 'ko')).toBe('요한복음 3:1–4:54');
    expect(formatRangeText(jhn([3, 16], [3, 16]), 'en')).toBe('John 3:16');
  });

  it('여러 범위는 언어별 구분자로 잇는다', () => {
    const ranges = [jhn([3, 1], [3, 21]), { bookId: 'ACT', start: { chapter: 9, verse: 32 }, end: { chapter: 10, verse: 8 } }];
    expect(formatPassageText(ranges, 'ko')).toBe('요한복음 3:1–21, 사도행전 9:32–10:8');
    expect(formatPassageText(ranges, 'en')).toBe('John 3:1–21; Acts 9:32–10:8');
  });
});

describe('날짜 표시', () => {
  it('YYYY-MM-DD를 시간대에 밀리지 않고 그 날짜로 표시한다', () => {
    expect(formatIsoDate('2026-09-24', 'ko')).toContain('9월 24일');
    expect(formatIsoDate('2026-09-24', 'en')).toContain('Sep');
    expect(formatIsoDate('2026-09-24', 'en')).toContain('24');
    expect(formatIsoDate('not-a-date', 'ko')).toBe('not-a-date');
  });

  it('시간대별 오늘 날짜: 같은 순간이 서울과 뉴욕에서 다른 날짜일 수 있다(AC18)', () => {
    const instant = new Date('2026-09-24T18:00:00Z');
    expect(localIsoDate(instant, 'Asia/Seoul')).toBe('2026-09-25');
    expect(localIsoDate(instant, 'America/New_York')).toBe('2026-09-24');
  });
});

describe('초기 언어 감지', () => {
  it('한국어면 ko, 그 외는 en, 정보가 없으면 ko', () => {
    expect(detectLang(['ko-KR', 'en'])).toBe('ko');
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['ja'])).toBe('en');
    expect(detectLang(undefined)).toBe('ko');
  });
});
