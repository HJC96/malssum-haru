import type { BibleData, BookId } from './types';

export function listBooks(bible: BibleData): Array<{ bookId: BookId; testament: 'OT' | 'NT'; order: number }> {
  return bible.books
    .map((b) => ({ bookId: b.bookId, testament: b.testament, order: b.order }))
    .sort((a, b) => a.order - b.order);
}

export interface BibleTotals {
  books: number;
  chapters: number;
  verses: number;
}

export function bibleTotals(bible: BibleData): BibleTotals {
  let chapters = 0;
  let verses = 0;
  for (const b of bible.books) {
    chapters += b.chapterVerseCounts.length;
    for (const n of b.chapterVerseCounts) verses += n;
  }
  return { books: bible.books.length, chapters, verses };
}

export interface BibleDataProblem {
  code:
    | 'BAD_BOOK_ID'
    | 'DUPLICATE_BOOK_ID'
    | 'BAD_ORDER'
    | 'DUPLICATE_ORDER'
    | 'NO_CHAPTERS'
    | 'BAD_VERSE_COUNT'
    | 'MISSING_VERSION'
    | 'TOTAL_MISMATCH'
    | 'CANON_LIST'
    | 'CANON_MISMATCH';
  message: string;
}

/**
 * 데이터 무결성 검사. 문제 목록을 돌려주고, 비어 있으면 통과다.
 * expected를 주면 책·장·절 합계도 대조한다(확정 데이터용, 예: 66권 1189장).
 */
export function validateBibleData(bible: BibleData, expected?: Partial<BibleTotals>): BibleDataProblem[] {
  const problems: BibleDataProblem[] = [];
  if (!bible.dataVersion) problems.push({ code: 'MISSING_VERSION', message: 'dataVersion is empty' });
  if (!bible.versificationSystem) {
    problems.push({ code: 'MISSING_VERSION', message: 'versificationSystem is empty' });
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const b of bible.books) {
    if (!/^[A-Z0-9]{3}$/.test(b.bookId)) {
      problems.push({ code: 'BAD_BOOK_ID', message: `bookId must be 3 uppercase chars: ${b.bookId}` });
    }
    if (ids.has(b.bookId)) problems.push({ code: 'DUPLICATE_BOOK_ID', message: `duplicate ${b.bookId}` });
    ids.add(b.bookId);
    if (!Number.isInteger(b.order) || b.order < 1) {
      problems.push({ code: 'BAD_ORDER', message: `${b.bookId}: order must be a positive integer` });
    }
    if (orders.has(b.order)) problems.push({ code: 'DUPLICATE_ORDER', message: `duplicate order ${b.order}` });
    orders.add(b.order);
    if (b.chapterVerseCounts.length === 0) {
      problems.push({ code: 'NO_CHAPTERS', message: `${b.bookId}: no chapters` });
    }
    b.chapterVerseCounts.forEach((n, i) => {
      if (!Number.isInteger(n) || n < 1) {
        problems.push({ code: 'BAD_VERSE_COUNT', message: `${b.bookId} ${i + 1}: verse count must be a positive integer` });
      }
    });
  }
  if (expected) {
    const totals = bibleTotals(bible);
    for (const key of ['books', 'chapters', 'verses'] as const) {
      const want = expected[key];
      if (want !== undefined && want !== totals[key]) {
        problems.push({ code: 'TOTAL_MISMATCH', message: `${key}: expected ${want}, got ${totals[key]}` });
      }
    }
  }
  return problems;
}

export interface CanonBook {
  bookId: BookId;
  testament: 'OT' | 'NT';
}

export const CANON_TOTALS = { books: 66, ot: 39, nt: 27 } as const;

/** 정경 목록(순서 = 정경 순서) 자체의 검사: 66권, 구약 39·신약 27, 중복·형식 오류 없음, 구약이 신약보다 앞. */
export function validateCanonList(canon: ReadonlyArray<CanonBook>): BibleDataProblem[] {
  const problems: BibleDataProblem[] = [];
  const ids = new Set<string>();
  let ot = 0;
  let nt = 0;
  let seenNt = false;
  for (const b of canon) {
    if (!/^[A-Z0-9]{3}$/.test(b.bookId)) {
      problems.push({ code: 'BAD_BOOK_ID', message: `bookId must be 3 uppercase chars: ${b.bookId}` });
    }
    if (ids.has(b.bookId)) problems.push({ code: 'DUPLICATE_BOOK_ID', message: `duplicate ${b.bookId}` });
    ids.add(b.bookId);
    if (b.testament === 'OT') {
      ot++;
      if (seenNt) problems.push({ code: 'CANON_LIST', message: `${b.bookId}: OT book after NT` });
    } else {
      nt++;
      seenNt = true;
    }
  }
  if (canon.length !== CANON_TOTALS.books) {
    problems.push({ code: 'CANON_LIST', message: `expected ${CANON_TOTALS.books} books, got ${canon.length}` });
  }
  if (ot !== CANON_TOTALS.ot || nt !== CANON_TOTALS.nt) {
    problems.push({ code: 'CANON_LIST', message: `expected OT ${CANON_TOTALS.ot} / NT ${CANON_TOTALS.nt}, got ${ot} / ${nt}` });
  }
  return problems;
}

/**
 * 성경 데이터의 bookId·order·testament를 정경 목록과 1:1로 대조한다.
 * complete=true면 데이터가 정경 전체(같은 책, 같은 순서)여야 하고, false면 부분집합(샘플용)이어도 각 책의 order와 testament가 맞아야 한다.
 */
export function validateAgainstCanon(
  bible: BibleData,
  canon: ReadonlyArray<CanonBook>,
  complete: boolean,
): BibleDataProblem[] {
  const problems: BibleDataProblem[] = [];
  const position = new Map(canon.map((b, i) => [b.bookId, { order: i + 1, testament: b.testament }]));
  for (const b of bible.books) {
    const c = position.get(b.bookId);
    if (!c) {
      problems.push({ code: 'CANON_MISMATCH', message: `${b.bookId}: not in canon` });
      continue;
    }
    if (b.order !== c.order) {
      problems.push({ code: 'CANON_MISMATCH', message: `${b.bookId}: order ${b.order}, canon ${c.order}` });
    }
    if (b.testament !== c.testament) {
      problems.push({ code: 'CANON_MISMATCH', message: `${b.bookId}: testament ${b.testament}, canon ${c.testament}` });
    }
  }
  if (complete) {
    const have = new Set(bible.books.map((b) => b.bookId));
    for (const c of canon) {
      if (!have.has(c.bookId)) problems.push({ code: 'CANON_MISMATCH', message: `${c.bookId}: missing` });
    }
    if (bible.books.length !== canon.length) {
      problems.push({ code: 'CANON_MISMATCH', message: `expected ${canon.length} books, got ${bible.books.length}` });
    }
  }
  return problems;
}

/** 정규 문자열: 책 순서대로 'ID 절수1 절수2 ...'를 만들고 ';'로 잇는다(데이터 해시 검증용). */
export function canonicalString(bible: BibleData): string {
  return [...bible.books]
    .sort((a, b) => a.order - b.order)
    .map((b) => `${b.bookId} ${b.chapterVerseCounts.join(' ')}`)
    .join(';');
}

/** 화면 표시용: 샘플(테스트 전용), 잠정, 확정 중 어느 데이터인지. */
export function bibleDataStatus(bible: BibleData): 'sample' | 'provisional' | 'confirmed' {
  if (bible.dataVersion.startsWith('sample')) return 'sample';
  return bible.versificationSystem.includes('provisional') ? 'provisional' : 'confirmed';
}
