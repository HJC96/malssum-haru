import type {
  BookId,
  IsoDate,
  PlanDay,
  PlanError,
  PlanInput,
  PlanOutcome,
  PlanSummary,
  ReadInput,
  VerseRange,
  Weekday,
} from './types';
import {
  indexBible,
  intervalsToRanges,
  ordinalPoint,
  pointOrdinal,
  rangesToSet,
  type BibleIndex,
  type BookIndex,
  type VerseSet,
} from './bibleIndex';
import { addDays, inclusiveDayCount, isValidIsoDate, toDayNumber, weekdayOfDayNumber } from './dates';
import { distributeUnits } from './distribute';
import { countIntervals, intersectIntervals, subtractIntervals, type Interval } from './intervals';

/** 계획 기간의 상한(일). 이보다 길면 PERIOD_TOO_LONG. */
export const MAX_PERIOD_DAYS = 3660;

const ALL_WEEKDAYS: ReadonlyArray<Weekday> = [0, 1, 2, 3, 4, 5, 6];

/** 한 장에서 아직 읽지 않은 절. 장 배분에서는 이 단위 전체를, 절 배분에서는 일부를 배정한다. */
interface Unit {
  book: BookIndex;
  chapter: number;
  intervals: Interval[];
  verses: number;
  chapterTotal: number;
}

function resolveTarget(input: PlanInput, index: BibleIndex, errors: PlanError[]): BookIndex[] {
  const t = input.target;
  const all = [...index.books.values()].sort((a, b) => a.order - b.order);
  let books: BookIndex[];
  if (t.kind === 'all') books = all;
  else if (t.kind === 'ot') books = all.filter((b) => b.testament === 'OT');
  else if (t.kind === 'nt') books = all.filter((b) => b.testament === 'NT');
  else {
    books = [];
    let unknown = false;
    const seen = new Set<BookId>();
    for (const id of t.bookIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const b = index.books.get(id);
      if (b) books.push(b);
      else {
        unknown = true;
        errors.push({ code: 'UNKNOWN_BOOK', detail: { field: 'target', bookId: id } });
      }
    }
    if (unknown) return [];
  }
  if (books.length === 0 || books.every((b) => b.totalVerses === 0)) {
    errors.push({ code: 'EMPTY_SCOPE' });
    return [];
  }
  return books;
}

/** 읽은 범위 입력을 책별 집합으로 바꾸고 검증한다. 오류가 있으면 errors에 넣고 null을 돌려준다. */
function resolveRanges(
  ranges: ReadonlyArray<VerseRange>,
  field: string,
  index: BibleIndex,
  targetIds: ReadonlySet<BookId>,
  errors: PlanError[],
): VerseSet | null {
  const c = rangesToSet(index, ranges);
  if (!c.ok) {
    errors.push({ code: c.code, detail: { field, bookId: c.bookId } });
    return null;
  }
  for (const id of c.set.keys()) {
    if (!targetIds.has(id)) {
      errors.push({ code: 'READ_OUTSIDE_TARGET', detail: { field, bookId: id } });
      return null;
    }
  }
  return c.set;
}

function resolveRead(
  read: ReadInput,
  index: BibleIndex,
  target: BookIndex[],
  targetIds: ReadonlySet<BookId>,
  errors: PlanError[],
): VerseSet | null {
  if (read.mode === 'none') return new Map();
  if (read.mode === 'ranges') return resolveRanges(read.ranges, 'read', index, targetIds, errors);

  const { bookId, chapter, verse } = read.through;
  const through = index.books.get(bookId);
  if (!through) {
    errors.push({ code: 'UNKNOWN_BOOK', detail: { field: 'read', bookId } });
    return null;
  }
  if (!targetIds.has(bookId)) {
    errors.push({ code: 'READ_OUTSIDE_TARGET', detail: { field: 'read', bookId } });
    return null;
  }
  const ord = pointOrdinal(through, { chapter, verse });
  if (ord === null) {
    errors.push({ code: 'INVALID_RANGE', detail: { field: 'read', bookId, chapter, verse } });
    return null;
  }
  const set: VerseSet = new Map();
  for (const b of target) {
    if (b.bookId === bookId) {
      set.set(b.bookId, [[0, ord + 1]]);
      break;
    }
    set.set(b.bookId, [[0, b.totalVerses]]);
  }
  return set;
}

/** 남은 절을 장 단위로 묶는다. 목표 순서를 유지한다. */
function buildUnits(target: BookIndex[], remaining: VerseSet): Unit[] {
  const units: Unit[] = [];
  for (const book of target) {
    const rem = remaining.get(book.bookId);
    if (!rem || rem.length === 0) continue;
    for (let c = 0; c < book.chapterVerseCounts.length; c++) {
      const chapterInterval: Interval = [book.prefix[c] as number, book.prefix[c + 1] as number];
      const pieces = intersectIntervals(rem, [chapterInterval]);
      if (pieces.length === 0) continue;
      units.push({
        book,
        chapter: c + 1,
        intervals: pieces,
        verses: countIntervals(pieces),
        chapterTotal: book.chapterVerseCounts[c] as number,
      });
    }
  }
  return units;
}

/** 단위 목록을 절 범위로 바꾼다. 같은 책에서 맞닿은 구간은 하나로 합친다. */
function unitsToRanges(units: ReadonlyArray<Unit>): VerseRange[] {
  const merged: Array<{ book: BookIndex; s: number; e: number }> = [];
  for (const u of units) {
    for (const [s, e] of u.intervals) {
      const last = merged[merged.length - 1];
      if (last && last.book === u.book && last.e === s) last.e = e;
      else merged.push({ book: u.book, s, e });
    }
  }
  return merged.map((m) => ({
    bookId: m.book.bookId,
    start: ordinalPoint(m.book, m.s),
    end: ordinalPoint(m.book, m.e - 1),
  }));
}

/** 남은 절을 성경 순서대로 고르게 나눈다. 한 장을 여러 날에 걸쳐 읽을 수 있다. */
function splitUnitsByVerses(units: ReadonlyArray<Unit>, days: number): Unit[][] {
  const byDay: Unit[][] = Array.from({ length: days }, () => []);
  if (days === 0) return byDay;
  const total = units.reduce((sum, unit) => sum + unit.verses, 0);
  const perDay = Math.floor(total / days);
  const extraDays = total % days;
  let unitIndex = 0;
  let intervalIndex = 0;
  let cursor = units[0]?.intervals[0]?.[0] ?? 0;

  for (let day = 0; day < days; day++) {
    let left = perDay + (day < extraDays ? 1 : 0);
    const assigned = byDay[day] as Unit[];
    while (left > 0) {
      const source = units[unitIndex] as Unit;
      const [, end] = source.intervals[intervalIndex] as Interval;
      const take = Math.min(left, end - cursor);
      let part = assigned[assigned.length - 1];
      if (!part || part.book !== source.book || part.chapter !== source.chapter) {
        part = { book: source.book, chapter: source.chapter, intervals: [], verses: 0, chapterTotal: source.chapterTotal };
        assigned.push(part);
      }
      part.intervals.push([cursor, cursor + take]);
      part.verses += take;
      cursor += take;
      left -= take;
      if (cursor === end) {
        intervalIndex++;
        if (intervalIndex === source.intervals.length) {
          unitIndex++;
          intervalIndex = 0;
        }
        cursor = units[unitIndex]?.intervals[intervalIndex]?.[0] ?? 0;
      }
    }
  }
  return byDay;
}

function checkDate(value: IsoDate, field: string, errors: PlanError[]): boolean {
  if (typeof value === 'string' && isValidIsoDate(value)) return true;
  errors.push({ code: 'INVALID_DATE', detail: { field, value: String(value) } });
  return false;
}

export function computePlan(input: PlanInput): PlanOutcome {
  const errors: PlanError[] = [];
  const index = indexBible(input.bible);

  // 날짜
  const startOk = checkDate(input.startDate, 'startDate', errors);
  const endOk = checkDate(input.endDate, 'endDate', errors);
  const asOfOk = input.asOf === undefined ? true : checkDate(input.asOf, 'asOf', errors);
  const excludedNumbers = new Set<number>();
  input.excludedDates.forEach((d, i) => {
    if (checkDate(d, `excludedDates[${i}]`, errors)) excludedNumbers.add(toDayNumber(d));
  });

  let startN = 0;
  let endN = 0;
  let periodOk = false;
  if (startOk && endOk) {
    startN = toDayNumber(input.startDate);
    endN = toDayNumber(input.endDate);
    if (startN > endN) {
      errors.push({ code: 'START_AFTER_END', detail: { startDate: input.startDate, endDate: input.endDate } });
    } else if (inclusiveDayCount(input.startDate, input.endDate) > MAX_PERIOD_DAYS) {
      errors.push({
        code: 'PERIOD_TOO_LONG',
        detail: { days: inclusiveDayCount(input.startDate, input.endDate), max: MAX_PERIOD_DAYS },
      });
    } else {
      periodOk = true;
    }
  }

  const weekdaySet = new Set<number>(input.weekdays.filter((w) => ALL_WEEKDAYS.includes(w)));
  const isReadingDay = (n: number): boolean => weekdaySet.has(weekdayOfDayNumber(n)) && !excludedNumbers.has(n);
  if (periodOk) {
    let any = false;
    for (let n = startN; n <= endN && !any; n++) any = isReadingDay(n);
    if (!any) errors.push({ code: 'NO_READING_DAYS' });
  }

  // 범위
  const target = resolveTarget(input, index, errors);
  const targetIds = new Set(target.map((b) => b.bookId));
  let read: VerseSet | null = null;
  let todayReadSet: VerseSet | null = null;
  if (target.length > 0) {
    read = resolveRead(input.read, index, target, targetIds, errors);
    const todayRanges = input.todayRead ?? [];
    todayReadSet = todayRanges.length > 0 ? resolveRanges(todayRanges, 'todayRead', index, targetIds, errors) : new Map();
  }

  if (errors.length > 0 || !periodOk || !asOfOk || read === null || todayReadSet === null) {
    return { ok: false, errors };
  }

  // 남은 범위와 배정 단위
  const remaining: VerseSet = new Map();
  let targetVerses = 0;
  let targetChapters = 0;
  for (const book of target) {
    targetVerses += book.totalVerses;
    targetChapters += book.chapterVerseCounts.length;
    const rem = subtractIntervals([[0, book.totalVerses]], read.get(book.bookId) ?? []);
    if (rem.length > 0) remaining.set(book.bookId, rem);
  }
  const units = buildUnits(target, remaining);
  const remainingVerses = units.reduce((a, u) => a + u.verses, 0);

  // 배정 대상 날짜
  const asOfN = input.asOf === undefined ? null : toDayNumber(input.asOf);
  const effectiveStart = asOfN === null ? startN : Math.max(asOfN, startN);
  const readingDayNumbers: number[] = [];
  for (let n = effectiveStart; n <= endN; n++) if (isReadingDay(n)) readingDayNumbers.push(n);

  if (remainingVerses > 0 && readingDayNumbers.length === 0) {
    return {
      ok: false,
      errors: [{ code: 'NO_DAYS_LEFT_WITH_REMAINING', detail: { remainingVerses, asOf: input.asOf ?? input.startDate } }],
    };
  }

  const chapterSizes = input.distribution === 'chapters'
    ? distributeUnits(units.map((u) => u.verses), readingDayNumbers.length, 'chapters')
    : null;
  const verseUnits = input.distribution === 'verses'
    ? splitUnitsByVerses(units, readingDayNumbers.length)
    : null;
  const unitsByDay = new Map<number, Unit[]>();
  let cursor = 0;
  readingDayNumbers.forEach((n, i) => {
    if (verseUnits) {
      unitsByDay.set(n, verseUnits[i] as Unit[]);
    } else {
      const take = chapterSizes?.[i] ?? 0;
      unitsByDay.set(n, units.slice(cursor, cursor + take));
      cursor += take;
    }
  });

  const days: PlanDay[] = [];
  for (let n = startN; n <= endN; n++) {
    const base = { date: addDays(input.startDate, n - startN), weekday: weekdayOfDayNumber(n) };
    const empty = { ranges: [], verseCount: 0, chapterCount: 0, partialChapters: [] };
    if (n < effectiveStart) {
      days.push({ ...base, status: 'elapsed', ...empty });
      continue;
    }
    const dayUnits = unitsByDay.get(n);
    if (dayUnits === undefined) {
      days.push({ ...base, status: 'off', ...empty });
    } else if (dayUnits.length === 0) {
      days.push({ ...base, status: 'empty', ...empty });
    } else {
      days.push({
        ...base,
        status: 'assigned',
        ranges: unitsToRanges(dayUnits),
        verseCount: dayUnits.reduce((a, u) => a + u.verses, 0),
        chapterCount: dayUnits.length,
        partialChapters: dayUnits
          .filter((u) => u.verses < u.chapterTotal)
          .map((u) => ({ bookId: u.book.bookId, chapter: u.chapter })),
      });
    }
  }

  // 오늘 목표와 달성률
  let todayTarget: PlanSummary['todayTarget'] = null;
  let todayAchievementPct: number | null = null;
  if (asOfN !== null && asOfN >= startN && asOfN <= endN) {
    const dayUnits = unitsByDay.get(asOfN);
    if (dayUnits && dayUnits.length > 0) {
      const ranges = unitsToRanges(dayUnits);
      const verses = dayUnits.reduce((a, u) => a + u.verses, 0);
      todayTarget = { verses, ranges };
      if (input.todayRead && input.todayRead.length > 0) {
        let done = 0;
        for (const u of dayUnits) {
          done += countIntervals(intersectIntervals(u.intervals, todayReadSet.get(u.book.bookId) ?? []));
        }
        todayAchievementPct = (done * 100) / verses;
      }
    }
  }

  const readVerses = targetVerses - remainingVerses;
  const remainingRanges: VerseRange[] = [];
  for (const book of target) {
    const rem = remaining.get(book.bookId);
    if (rem) remainingRanges.push(...intervalsToRanges(book, rem));
  }

  return {
    ok: true,
    result: {
      contractVersion: '1',
      dataVersion: input.bible.dataVersion,
      versificationSystem: input.bible.versificationSystem,
      distribution: input.distribution,
      recalculatedFrom: input.asOf !== undefined && asOfN !== null && asOfN > startN ? input.asOf : null,
      summary: {
        targetChapters,
        targetVerses,
        readVerses,
        remainingVerses,
        remainingChapters: units.length,
        progressPct: (readVerses * 100) / targetVerses,
        readingDays: readingDayNumbers.length,
        assignedDays: days.filter((d) => d.status === 'assigned').length,
        avgVersesPerDay: readingDayNumbers.length === 0 ? null : remainingVerses / readingDayNumbers.length,
        todayTarget,
        todayAchievementPct,
      },
      remainingRanges,
      days,
    },
  };
}
