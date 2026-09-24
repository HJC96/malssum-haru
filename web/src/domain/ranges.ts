import type { BibleData, VerseRange } from './types';
import { indexBible, intervalsToRanges, rangeToInterval, rangesToSet, type BibleIndex, type VerseSet } from './bibleIndex';
import { countIntervals, intersectIntervals, subtractIntervals, unionIntervals, type Interval } from './intervals';

// 범위 집합 연산(절 단위). 입력은 유효한 범위여야 하며, 잘못된 범위는 RangeError를 던진다.
// 검증이 필요하면 먼저 validateRange를 쓴다. computePlan은 항상 먼저 검증한다.

/** 범위가 데이터에 맞는지 확인한다. 맞으면 null. */
export function validateRange(bible: BibleData, r: VerseRange): 'UNKNOWN_BOOK' | 'INVALID_RANGE' | null {
  const c = rangeToInterval(indexBible(bible), r);
  return c.ok ? null : c.code;
}

function toSet(index: BibleIndex, ranges: ReadonlyArray<VerseRange>): VerseSet {
  const c = rangesToSet(index, ranges);
  if (!c.ok) throw new RangeError(`${c.code}: ${c.bookId}`);
  return c.set;
}

/** 책 순서(order)대로 정렬해 VerseRange 목록으로 바꾼다. */
function setToRanges(index: BibleIndex, set: VerseSet): VerseRange[] {
  const ids = [...set.keys()].sort(
    (a, b) => (index.books.get(a)?.order ?? 0) - (index.books.get(b)?.order ?? 0),
  );
  const out: VerseRange[] = [];
  for (const id of ids) {
    const book = index.books.get(id);
    const list = set.get(id);
    if (book && list) out.push(...intervalsToRanges(book, list));
  }
  return out;
}

function combine(
  bible: BibleData,
  a: ReadonlyArray<VerseRange>,
  b: ReadonlyArray<VerseRange>,
  op: (x: ReadonlyArray<Interval>, y: ReadonlyArray<Interval>) => Interval[],
  ids: (sa: VerseSet, sb: VerseSet) => Iterable<string>,
): VerseRange[] {
  const index = indexBible(bible);
  const sa = toSet(index, a);
  const sb = toSet(index, b);
  const out: VerseSet = new Map();
  for (const id of ids(sa, sb)) {
    const list = op(sa.get(id) ?? [], sb.get(id) ?? []);
    if (list.length > 0) out.set(id, list);
  }
  return setToRanges(index, out);
}

/** 겹치거나 맞닿은 범위를 합쳐 책 순서대로 돌려준다. */
export function normalizeRanges(bible: BibleData, ranges: ReadonlyArray<VerseRange>): VerseRange[] {
  const index = indexBible(bible);
  return setToRanges(index, toSet(index, ranges));
}

export function unionRanges(bible: BibleData, a: ReadonlyArray<VerseRange>, b: ReadonlyArray<VerseRange>): VerseRange[] {
  return combine(bible, a, b, unionIntervals, (x, y) => new Set([...x.keys(), ...y.keys()]));
}

/** a − b */
export function subtractRanges(
  bible: BibleData,
  a: ReadonlyArray<VerseRange>,
  b: ReadonlyArray<VerseRange>,
): VerseRange[] {
  return combine(bible, a, b, subtractIntervals, (x) => x.keys());
}

export function intersectRanges(
  bible: BibleData,
  a: ReadonlyArray<VerseRange>,
  b: ReadonlyArray<VerseRange>,
): VerseRange[] {
  return combine(bible, a, b, intersectIntervals, (x) => x.keys());
}

/** 범위 목록의 중복 없는 절 수. */
export function verseCount(bible: BibleData, ranges: ReadonlyArray<VerseRange>): number {
  const set = toSet(indexBible(bible), ranges);
  let n = 0;
  for (const list of set.values()) n += countIntervals(list);
  return n;
}

/** inner의 모든 절이 outer 안에 있으면 true(목표 안/밖 판정). */
export function isWithin(bible: BibleData, inner: ReadonlyArray<VerseRange>, outer: ReadonlyArray<VerseRange>): boolean {
  return subtractRanges(bible, inner, outer).length === 0;
}

/** 그 장에서 ranges가 차지하는 절이 장 전체보다 적고 0보다 많으면 true. */
export function isPartialChapter(
  bible: BibleData,
  ranges: ReadonlyArray<VerseRange>,
  bookId: string,
  chapter: number,
): boolean {
  const index = indexBible(bible);
  const book = index.books.get(bookId);
  const total = book?.chapterVerseCounts[chapter - 1];
  if (!book || total === undefined) return false;
  const whole: VerseRange = { bookId, start: { chapter, verse: 1 }, end: { chapter, verse: total } };
  const n = verseCount(bible, intersectRanges(bible, ranges, [whole]));
  return n > 0 && n < total;
}
