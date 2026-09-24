import type { BibleData, PlanInput, PlanResult, VerseRange } from './types';
import { computePlan } from './plan';
import { SAMPLE_BIBLE } from '../data/sampleBible';

/** 테스트 전용 보조 함수. 계산 엔진과 독립된 방식(절을 하나씩 펼침)으로 검증하기 위해 둔다. */

export function range(bookId: string, c1: number, v1: number, c2: number, v2: number): VerseRange {
  return { bookId, start: { chapter: c1, verse: v1 }, end: { chapter: c2, verse: v2 } };
}

/** 범위를 'GEN 1:3' 같은 절 키의 집합으로 펼친다. 유효한 범위만 넣는다. */
export function expandVerses(bible: BibleData, ranges: ReadonlyArray<VerseRange>): Set<string> {
  const out = new Set<string>();
  for (const r of ranges) {
    const book = bible.books.find((b) => b.bookId === r.bookId);
    if (!book) throw new Error(`unknown book ${r.bookId}`);
    for (let c = r.start.chapter; c <= r.end.chapter; c++) {
      const count = book.chapterVerseCounts[c - 1] as number;
      const from = c === r.start.chapter ? r.start.verse : 1;
      const to = c === r.end.chapter ? r.end.verse : count;
      for (let v = from; v <= to; v++) out.add(`${r.bookId} ${c}:${v}`);
    }
  }
  return out;
}

/** 범위를 주어진 순서 그대로 절 키 배열로 펼친다(중복 포함). */
export function expandOrdered(bible: BibleData, ranges: ReadonlyArray<VerseRange>): string[] {
  const out: string[] = [];
  for (const r of ranges) {
    const book = bible.books.find((b) => b.bookId === r.bookId);
    if (!book) throw new Error(`unknown book ${r.bookId}`);
    for (let c = r.start.chapter; c <= r.end.chapter; c++) {
      const count = book.chapterVerseCounts[c - 1] as number;
      const from = c === r.start.chapter ? r.start.verse : 1;
      const to = c === r.end.chapter ? r.end.verse : count;
      for (let v = from; v <= to; v++) out.push(`${r.bookId} ${c}:${v}`);
    }
  }
  return out;
}

/** 책 하나의 모든 절 키. */
export function allVerses(bible: BibleData, bookIds: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of bookIds) {
    const book = bible.books.find((b) => b.bookId === id);
    if (!book) continue;
    book.chapterVerseCounts.forEach((n, i) => {
      for (let v = 1; v <= n; v++) out.add(`${id} ${i + 1}:${v}`);
    });
  }
  return out;
}

export function baseInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    bible: SAMPLE_BIBLE,
    target: { kind: 'all' },
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    excludedDates: [],
    distribution: 'verses',
    read: { mode: 'none' },
    ...overrides,
  };
}

export function mustPlan(input: PlanInput): PlanResult {
  const out = computePlan(input);
  if (!out.ok) throw new Error(`expected ok, got ${JSON.stringify(out.errors)}`);
  return out.result;
}

/** 시드 고정 PRNG(mulberry32). 외부 라이브러리 없이 같은 시드에서 같은 수열을 만든다. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
