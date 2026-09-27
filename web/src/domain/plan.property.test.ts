import { describe, expect, it } from 'vitest';
import { computePlan } from './plan';
import { distributeUnits } from './distribute';
import { expandOrdered, makeRng, range } from './testHelpers';
import type { BibleData, Distribution, PlanErrorCode, PlanInput, PlanResult, ReadInput, VerseRange, Weekday } from './types';

// 무작위 입력으로 계약 불변식 1~7을 검사한다. 시드가 고정되어 있어 재현 가능하다.
// 오라클은 계산 엔진과 다르게 절을 하나씩 펼치고 Date.UTC로 요일을 구한다.

type Rng = () => number;
const pick = <T>(rng: Rng, xs: ReadonlyArray<T>): T => xs[Math.floor(rng() * xs.length)] as T;
const int = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

const BOOK_IDS = ['GEN', 'EXO', 'PSA', 'MAT', 'JHN', 'REV'];

function randomBible(rng: Rng): BibleData {
  const n = int(rng, 1, 6);
  const otCount = int(rng, 0, n);
  return {
    dataVersion: 'prop-test',
    versificationSystem: 'prop-test',
    books: BOOK_IDS.slice(0, n).map((bookId, i) => ({
      bookId,
      testament: i < otCount ? ('OT' as const) : ('NT' as const),
      order: i + 1,
      chapterVerseCounts: Array.from({ length: int(rng, 1, 6) }, () => (rng() < 0.15 ? 1 : int(rng, 1, 30))),
    })),
  };
}

// 2024-02-20(윤년의 2월), 2026-12-20(연말), 2025-01-28(월 경계) 근처를 함께 시험한다
const BASES = [Date.UTC(2024, 1, 20), Date.UTC(2026, 11, 20), Date.UTC(2025, 0, 28)];
const DAY_MS = 86400000;
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

interface Case {
  input: PlanInput;
  targetIds: string[]; // 오라클이 계산한 목표 책 순서
  startMs: number;
  endMs: number;
}

function targetBooks(bible: BibleData, target: PlanInput['target']): string[] {
  const sorted = [...bible.books].sort((a, b) => a.order - b.order);
  if (target.kind === 'all') return sorted.map((b) => b.bookId);
  if (target.kind === 'ot') return sorted.filter((b) => b.testament === 'OT').map((b) => b.bookId);
  if (target.kind === 'nt') return sorted.filter((b) => b.testament === 'NT').map((b) => b.bookId);
  return [...new Set(target.bookIds)];
}

function randomRange(rng: Rng, bible: BibleData, bookId: string): VerseRange {
  const book = bible.books.find((b) => b.bookId === bookId)!;
  const flat: Array<[number, number]> = [];
  book.chapterVerseCounts.forEach((n, i) => {
    for (let v = 1; v <= n; v++) flat.push([i + 1, v]);
  });
  const i = int(rng, 0, flat.length - 1);
  const j = Math.min(flat.length - 1, i + int(rng, 0, 25));
  const [c1, v1] = flat[i]!;
  const [c2, v2] = flat[j]!;
  return range(bookId, c1, v1, c2, v2);
}

function randomCase(rng: Rng): Case {
  const bible = randomBible(rng);
  const ids = bible.books.map((b) => b.bookId);
  const kindRoll = rng();
  const target: PlanInput['target'] =
    kindRoll < 0.35
      ? { kind: 'all' }
      : kindRoll < 0.45
        ? { kind: 'ot' }
        : kindRoll < 0.55
          ? { kind: 'nt' }
          : { kind: 'books', bookIds: ids.filter(() => rng() < 0.6).sort(() => rng() - 0.5) };

  const baseMs = pick(rng, BASES);
  const startMs = baseMs + int(rng, 0, 20) * DAY_MS;
  const endMs = startMs + int(rng, rng() < 0.05 ? -3 : 0, 45) * DAY_MS;
  const weekdays = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter(() => rng() < 0.55);
  const excludedDates = Array.from({ length: int(rng, 0, 4) }, () => iso(startMs + int(rng, -2, 48) * DAY_MS));

  const readRoll = rng();
  let read: ReadInput = { mode: 'none' };
  if (readRoll < 0.4) {
    const b = pick(rng, ids);
    const rr = randomRange(rng, bible, b);
    read = { mode: 'continuous', through: { bookId: b, chapter: rr.start.chapter, verse: rr.start.verse } };
  } else if (readRoll < 0.8) {
    read = {
      mode: 'ranges',
      ranges: Array.from({ length: int(rng, 0, 3) }, () => randomRange(rng, bible, pick(rng, ids))),
    };
  }

  const input: PlanInput = {
    bible,
    target,
    startDate: iso(startMs),
    endDate: iso(endMs),
    weekdays,
    excludedDates,
    distribution: pick<Distribution>(rng, ['chapters', 'verses']),
    read,
  };
  if (rng() < 0.6) input.asOf = iso(startMs + int(rng, -3, 50) * DAY_MS);
  if (rng() < 0.4) {
    input.todayRead = Array.from({ length: int(rng, 0, 2) }, () => randomRange(rng, bible, pick(rng, ids)));
  }
  return { input, targetIds: targetBooks(bible, target), startMs, endMs };
}

/** 목표 순서대로 모든 절 키. */
function targetSequence(bible: BibleData, targetIds: string[]): string[] {
  const out: string[] = [];
  for (const id of targetIds) {
    const book = bible.books.find((b) => b.bookId === id)!;
    book.chapterVerseCounts.forEach((n, i) => {
      for (let v = 1; v <= n; v++) out.push(`${id} ${i + 1}:${v}`);
    });
  }
  return out;
}

/** 절 키 → 'BOOK c'(장 키). */
const chapterKey = (verseKey: string): string => verseKey.slice(0, verseKey.indexOf(':'));

interface Expectation {
  codes: Set<PlanErrorCode>;
  remaining: string[]; // 목표 순서의 미독 절(오류가 없을 때)
  read: Set<string>;
}

/** 입력만 보고 기대 오류와 기대 남은 범위를 계산하는 오라클. */
function oracle(c: Case): Expectation {
  const { input, targetIds } = c;
  const codes = new Set<PlanErrorCode>();
  const startDayMs = c.startMs;
  const endDayMs = c.endMs;
  if (startDayMs > endDayMs) codes.add('START_AFTER_END');
  const isReading = (ms: number): boolean =>
    input.weekdays.includes(new Date(ms).getUTCDay() as Weekday) && !input.excludedDates.includes(iso(ms));
  if (startDayMs <= endDayMs) {
    let any = false;
    for (let ms = startDayMs; ms <= endDayMs; ms += DAY_MS) any ||= isReading(ms);
    if (!any) codes.add('NO_READING_DAYS');
  }
  if (targetIds.length === 0) codes.add('EMPTY_SCOPE');

  const seq = targetSequence(input.bible, targetIds);
  const targetSet = new Set(targetIds);
  const read = new Set<string>();
  if (targetIds.length > 0) {
    if (input.read.mode === 'continuous') {
      const t = input.read.through;
      if (!targetSet.has(t.bookId)) codes.add('READ_OUTSIDE_TARGET');
      else {
        const key = `${t.bookId} ${t.chapter}:${t.verse}`;
        for (const k of seq) {
          read.add(k);
          if (k === key) break;
        }
      }
    } else if (input.read.mode === 'ranges') {
      if (input.read.ranges.some((r) => !targetSet.has(r.bookId))) codes.add('READ_OUTSIDE_TARGET');
      else for (const k of expandOrdered(input.bible, input.read.ranges)) read.add(k);
    }
    if ((input.todayRead ?? []).some((r) => !targetSet.has(r.bookId))) codes.add('READ_OUTSIDE_TARGET');
  }
  const remaining = seq.filter((k) => !read.has(k));

  if (codes.size === 0) {
    const effectiveStart = input.asOf === undefined ? startDayMs : Math.max(startDayMs, Date.parse(input.asOf));
    let left = 0;
    for (let ms = effectiveStart; ms <= endDayMs; ms += DAY_MS) if (isReading(ms)) left++;
    if (left === 0 && remaining.length > 0) codes.add('NO_DAYS_LEFT_WITH_REMAINING');
  }
  return { codes, remaining, read };
}

function checkInvariants(c: Case, r: PlanResult, exp: Expectation): void {
  const { input } = c;
  const { bible } = input;
  const isReading = (ms: number): boolean =>
    input.weekdays.includes(new Date(ms).getUTCDay() as Weekday) && !input.excludedDates.includes(iso(ms));
  const effectiveStartMs = input.asOf === undefined ? c.startMs : Math.max(c.startMs, Date.parse(input.asOf));

  // 불변식 1: 날짜별 배정의 합집합 = 남은 범위, 날짜 사이 중복 없음, 순서 유지
  const flat = r.days.flatMap((d) => expandOrdered(bible, d.ranges));
  expect(flat).toEqual(exp.remaining); // 같은 절이 같은 순서로 정확히 한 번씩
  expect(expandOrdered(bible, r.remainingRanges)).toEqual(exp.remaining);
  for (const d of r.days) {
    expect(d.ranges.length === 0).toBe(d.status !== 'assigned');
  }

  // 불변식 2
  expect(r.days.reduce((a, d) => a + d.verseCount, 0)).toBe(r.summary.remainingVerses);
  expect(r.summary.remainingVerses).toBe(exp.remaining.length);
  for (const d of r.days) {
    expect(d.verseCount).toBe(expandOrdered(bible, d.ranges).length);
    const chapters = new Set(expandOrdered(bible, d.ranges).map(chapterKey));
    expect(d.chapterCount).toBe(chapters.size);
  }

  // 불변식 3
  const s = r.summary;
  expect(s.progressPct).toBeGreaterThanOrEqual(0);
  expect(s.progressPct).toBeLessThanOrEqual(100);
  expect(s.targetVerses).toBe(s.readVerses + s.remainingVerses);
  expect(s.readVerses).toBe(exp.read.size);
  expect(s.remainingChapters).toBe(new Set(exp.remaining.map(chapterKey)).size);
  expect(s.targetChapters).toBe(new Set(targetSequence(bible, c.targetIds).map(chapterKey)).size);

  // 불변식 4: 날짜·요일·상태
  expect(r.days).toHaveLength((c.endMs - c.startMs) / DAY_MS + 1);
  let readingDays = 0;
  r.days.forEach((d, i) => {
    const ms = c.startMs + i * DAY_MS;
    expect(d.date).toBe(iso(ms));
    expect(d.weekday).toBe(new Date(ms).getUTCDay());
    if (ms < effectiveStartMs) expect(d.status).toBe('elapsed');
    else if (!isReading(ms)) expect(d.status).toBe('off');
    else {
      readingDays++;
      expect(['assigned', 'empty']).toContain(d.status);
    }
  });
  expect(s.readingDays).toBe(readingDays);
  expect(s.assignedDays).toBe(r.days.filter((d) => d.status === 'assigned').length);
  expect(s.avgVersesPerDay).toBe(readingDays === 0 ? null : s.remainingVerses / readingDays);
  expect(r.recalculatedFrom).toBe(input.asOf !== undefined && Date.parse(input.asOf) > c.startMs ? input.asOf : null);

  // 불변식 5: 장/절 단위 배분과 부분 장 표시
  const remainingByChapter = new Map<string, number>();
  for (const k of exp.remaining) remainingByChapter.set(chapterKey(k), (remainingByChapter.get(chapterKey(k)) ?? 0) + 1);
  const assignedByChapter = new Map<string, number>();
  r.days.forEach((d) => {
    const perChapter = new Map<string, number>();
    for (const k of expandOrdered(bible, d.ranges)) perChapter.set(chapterKey(k), (perChapter.get(chapterKey(k)) ?? 0) + 1);
    for (const [ch, n] of perChapter) {
      if (input.distribution === 'chapters') {
        expect(assignedByChapter.has(ch)).toBe(false); // 장 단위라면 한 장은 한 날에만
        expect(n).toBe(remainingByChapter.get(ch));
      }
      assignedByChapter.set(ch, (assignedByChapter.get(ch) ?? 0) + n);
    }
    // 부분 장 = 그 날의 배정이 장 전체(절 수)보다 적은 장
    const partial = [...perChapter].filter(([ch, n]) => n < chapterTotal(bible, ch)).map(([ch]) => ch);
    expect(d.partialChapters.map((p) => `${p.bookId} ${p.chapter}`)).toEqual(partial);
  });
  expect(assignedByChapter).toEqual(remainingByChapter);
  const readingDayList = r.days.filter((d) => d.status === 'assigned' || d.status === 'empty');
  const chapterCounts = readingDayList.map((d) => d.chapterCount);
  if (input.distribution === 'chapters') {
    if (s.remainingChapters >= readingDays) {
      if (readingDays > 0) expect(readingDayList.every((d) => d.status === 'assigned')).toBe(true);
    } else {
      expect(s.assignedDays).toBe(s.remainingChapters);
      expect(Math.max(0, ...chapterCounts)).toBeLessThanOrEqual(1);
    }
    if (readingDays > 0) expect(Math.max(...chapterCounts) - Math.min(...chapterCounts)).toBeLessThanOrEqual(1);
  } else {
    expect(s.assignedDays).toBe(Math.min(s.remainingVerses, readingDays));
    const verseCounts = readingDayList.map((d) => d.verseCount);
    if (verseCounts.length > 0) expect(Math.max(...verseCounts) - Math.min(...verseCounts)).toBeLessThanOrEqual(1);
  }
  // 읽은 범위 때문에 부분 장이 첫 배정 단위이다: 남은 첫 절이 장 중간이면 첫 배정 범위가 그 절에서 시작한다
  const firstAssigned = r.days.find((d) => d.status === 'assigned');
  if (firstAssigned && exp.remaining.length > 0) {
    expect(expandOrdered(bible, firstAssigned.ranges)[0]).toBe(exp.remaining[0]);
  }

  // 불변식 6: 오늘 달성률
  const asOfIndex = input.asOf === undefined ? -1 : (Date.parse(input.asOf) - c.startMs) / DAY_MS;
  const today = asOfIndex >= 0 && asOfIndex < r.days.length ? r.days[asOfIndex] : undefined;
  if (today && today.status === 'assigned') {
    expect(s.todayTarget).toEqual({ verses: today.verseCount, ranges: today.ranges });
  } else {
    expect(s.todayTarget).toBeNull();
  }
  if (!s.todayTarget || !input.todayRead || input.todayRead.length === 0) {
    expect(s.todayAchievementPct).toBeNull();
  } else {
    const done = new Set(expandOrdered(bible, input.todayRead));
    const hit = expandOrdered(bible, s.todayTarget.ranges).filter((k) => done.has(k)).length;
    expect(s.todayAchievementPct).toBeCloseTo((hit * 100) / s.todayTarget.verses, 9);
    expect(s.todayAchievementPct).toBeGreaterThanOrEqual(0);
    expect(s.todayAchievementPct).toBeLessThanOrEqual(100);
  }
}

function chapterTotal(bible: BibleData, chapterKeyStr: string): number {
  const [bookId, chapter] = chapterKeyStr.split(' ') as [string, string];
  return bible.books.find((b) => b.bookId === bookId)!.chapterVerseCounts[Number(chapter) - 1]!;
}

describe('계약 불변식 1~7 property (AC03 AC04 AC05 AC06 AC08 AC23 AC24)', () => {
  it('무작위 입력 3000건: 성공이면 불변식 성립, 실패면 기대한 오류 코드와 정확히 일치', () => {
    const rng = makeRng(0x5eed);
    let ok = 0;
    const seenErrors = new Set<PlanErrorCode>();
    for (let n = 0; n < 3000; n++) {
      const c = randomCase(rng);
      const exp = oracle(c);
      const before = structuredClone(c.input);
      const out = computePlan(c.input);
      expect(c.input).toEqual(before); // 입력을 바꾸지 않는다
      if (exp.codes.size > 0) {
        expect(out.ok).toBe(false);
        if (!out.ok) {
          const got = new Set(out.errors.map((e) => e.code));
          expect(got).toEqual(exp.codes);
          got.forEach((code) => seenErrors.add(code));
        }
      } else {
        expect(out.ok).toBe(true);
        if (out.ok) {
          ok++;
          checkInvariants(c, out.result, exp);
          // 불변식 7: 같은 입력 → 같은 출력
          expect(computePlan(c.input)).toEqual(out);
        }
      }
    }
    expect(ok).toBeGreaterThan(800);
    // 시험이 모든 오류 경로를 실제로 지나갔는지 확인
    for (const code of ['START_AFTER_END', 'NO_READING_DAYS', 'EMPTY_SCOPE', 'READ_OUTSIDE_TARGET', 'NO_DAYS_LEFT_WITH_REMAINING'] as const) {
      expect(seenErrors.has(code)).toBe(true);
    }
  }, 15000);

  it('윤년 2월 29일을 지나는 기간이 시험에 포함된다', () => {
    const rng = makeRng(7);
    let crossed = 0;
    for (let n = 0; n < 500; n++) {
      const c = randomCase(rng);
      const out = computePlan(c.input);
      if (out.ok && out.result.days.some((d) => d.date === '2024-02-29')) crossed++;
    }
    expect(crossed).toBeGreaterThan(20);
  });
});

describe('distributeUnits', () => {
  it('합은 단위 수와 같고 단위가 날짜보다 적으면 앞에서부터 하루 하나', () => {
    expect(distributeUnits([5, 5, 5], 5, 'verses')).toEqual([1, 1, 1, 0, 0]);
    expect(distributeUnits([5, 5, 5], 5, 'chapters')).toEqual([1, 1, 1, 0, 0]);
    expect(distributeUnits([], 4, 'verses')).toEqual([0, 0, 0, 0]);
    expect(distributeUnits([1, 2], 0, 'verses')).toEqual([]);
  });

  it('chapters: 앞쪽 날에 나머지를 하나씩 더 배정', () => {
    expect(distributeUnits(new Array(10).fill(1), 4, 'chapters')).toEqual([3, 3, 2, 2]);
  });

  it('verses: 장 크기가 모두 같으면 날마다 받는 장 수가 1 이상 차이 나지 않는다', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const n = int(rng, 1, 40);
      const d = int(rng, 1, 30);
      const w = new Array(n).fill(int(rng, 1, 40));
      const sizes = distributeUnits(w, d, 'verses');
      const max = Math.max(...sizes);
      const min = Math.min(...sizes);
      expect(max - min).toBeLessThanOrEqual(1);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it('verses: 큰 장이 있으면 그 장 하나로 하루를 채우고 남은 날에 나머지를 나눈다', () => {
    // 총 60절, 2일: 첫 날 목표 30 → 10+10(=20)이 40보다 가깝다. 남은 날은 큰 장 40절
    expect(distributeUnits([10, 10, 40], 2, 'verses')).toEqual([2, 1]);
    expect(distributeUnits([40, 10, 10], 2, 'verses')).toEqual([1, 2]);
  });

  it('무작위: 단위가 날짜 이상이면 모든 날이 최소 한 단위를 받고 합이 맞다', () => {
    const rng = makeRng(31337);
    for (let i = 0; i < 500; i++) {
      const n = int(rng, 0, 40);
      const d = int(rng, 0, 30);
      const w = Array.from({ length: n }, () => int(rng, 1, 176));
      for (const mode of ['chapters', 'verses'] as const) {
        const sizes = distributeUnits(w, d, mode);
        expect(sizes).toHaveLength(d);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(d === 0 ? 0 : n);
        if (n >= d && d > 0) expect(Math.min(...sizes)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
