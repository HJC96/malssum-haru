import type { BibleData, BookId, VersePoint, VerseRange } from './types';
import { normalizeIntervals, type Interval } from './intervals';

export interface BookIndex {
  bookId: BookId;
  testament: 'OT' | 'NT';
  order: number;
  chapterVerseCounts: ReadonlyArray<number>;
  /** prefix[c] = c장 앞까지의 절 수. prefix[0] = 0, 마지막 값 = 책의 절 수. */
  prefix: ReadonlyArray<number>;
  totalVerses: number;
}

export interface BibleIndex {
  bible: BibleData;
  books: ReadonlyMap<BookId, BookIndex>;
}

const cache = new WeakMap<BibleData, BibleIndex>();

export function indexBible(bible: BibleData): BibleIndex {
  const cached = cache.get(bible);
  if (cached) return cached;
  const books = new Map<BookId, BookIndex>();
  for (const b of bible.books) {
    const prefix = [0];
    for (const n of b.chapterVerseCounts) prefix.push((prefix[prefix.length - 1] as number) + n);
    books.set(b.bookId, {
      bookId: b.bookId,
      testament: b.testament,
      order: b.order,
      chapterVerseCounts: b.chapterVerseCounts,
      prefix,
      totalVerses: prefix[prefix.length - 1] as number,
    });
  }
  const index = { bible, books };
  cache.set(bible, index);
  return index;
}

export type RangeErrorCode = 'UNKNOWN_BOOK' | 'INVALID_RANGE';

export function pointOrdinal(book: BookIndex, p: VersePoint): number | null {
  if (!Number.isInteger(p.chapter) || !Number.isInteger(p.verse)) return null;
  const count = book.chapterVerseCounts[p.chapter - 1];
  if (count === undefined || p.verse < 1 || p.verse > count) return null;
  return (book.prefix[p.chapter - 1] as number) + p.verse - 1;
}

/** 절 순번 → (장, 절). 순번은 0 ≤ ord < totalVerses. */
export function ordinalPoint(book: BookIndex, ord: number): VersePoint {
  let lo = 0;
  let hi = book.chapterVerseCounts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((book.prefix[mid + 1] as number) > ord) hi = mid;
    else lo = mid + 1;
  }
  return { chapter: lo + 1, verse: ord - (book.prefix[lo] as number) + 1 };
}

export type IntervalConversion =
  | { ok: true; bookId: BookId; interval: Interval }
  | { ok: false; code: RangeErrorCode };

export function rangeToInterval(index: BibleIndex, r: VerseRange): IntervalConversion {
  const book = index.books.get(r.bookId);
  if (!book) return { ok: false, code: 'UNKNOWN_BOOK' };
  const s = pointOrdinal(book, r.start);
  const e = pointOrdinal(book, r.end);
  if (s === null || e === null || s > e) return { ok: false, code: 'INVALID_RANGE' };
  return { ok: true, bookId: r.bookId, interval: [s, e + 1] };
}

/** 책별 구간 집합. 값은 정규화된 목록이다. */
export type VerseSet = Map<BookId, Interval[]>;

export type SetConversion = { ok: true; set: VerseSet } | { ok: false; code: RangeErrorCode; bookId: BookId };

export function rangesToSet(index: BibleIndex, ranges: ReadonlyArray<VerseRange>): SetConversion {
  const raw = new Map<BookId, Interval[]>();
  for (const r of ranges) {
    const c = rangeToInterval(index, r);
    if (!c.ok) return { ok: false, code: c.code, bookId: r.bookId };
    const list = raw.get(c.bookId);
    if (list) list.push(c.interval);
    else raw.set(c.bookId, [c.interval]);
  }
  const set: VerseSet = new Map();
  for (const [id, list] of raw) set.set(id, normalizeIntervals(list));
  return { ok: true, set };
}

/** 구간 목록을 절 순번 순서의 VerseRange로 바꾼다. 장을 건너 이어지는 범위는 하나로 합쳐진다. */
export function intervalsToRanges(book: BookIndex, list: ReadonlyArray<Interval>): VerseRange[] {
  return list.map(([s, e]) => ({
    bookId: book.bookId,
    start: ordinalPoint(book, s),
    end: ordinalPoint(book, e - 1),
  }));
}
