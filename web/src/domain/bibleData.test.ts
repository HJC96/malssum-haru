import { describe, expect, it } from 'vitest';
import { SAMPLE_BIBLE } from '../data/sampleBible';
import { bibleTotals, listBooks, validateBibleData } from './bibleData';
import type { BibleData } from './types';

describe('성경 데이터 검증 (T07)', () => {
  it('SAMPLE_BIBLE은 sample-0이고 무결성 검사를 통과한다', () => {
    expect(SAMPLE_BIBLE.dataVersion).toBe('sample-0');
    expect(validateBibleData(SAMPLE_BIBLE)).toEqual([]);
  });

  it('샘플은 일부러 절 수가 불균등한 장을 포함하고 1장짜리 책이 있다', () => {
    const counts = SAMPLE_BIBLE.books.flatMap((b) => [...b.chapterVerseCounts]);
    expect(Math.max(...counts) / Math.min(...counts)).toBeGreaterThan(10);
    expect(SAMPLE_BIBLE.books.some((b) => b.chapterVerseCounts.length === 1)).toBe(true);
  });

  it('책·장·절 합계를 계산하고 기대값과 대조한다', () => {
    expect(bibleTotals(SAMPLE_BIBLE)).toEqual({ books: 5, chapters: 15, verses: 167 });
    expect(validateBibleData(SAMPLE_BIBLE, { books: 5, chapters: 15, verses: 167 })).toEqual([]);
    const problems = validateBibleData(SAMPLE_BIBLE, { books: 66, chapters: 1189 });
    expect(problems.map((p) => p.code)).toEqual(['TOTAL_MISMATCH', 'TOTAL_MISMATCH']);
  });

  it('잘못된 데이터를 잡아낸다', () => {
    const bad: BibleData = {
      dataVersion: '',
      versificationSystem: 'x',
      books: [
        { bookId: 'GEN', testament: 'OT', order: 1, chapterVerseCounts: [3, 0] },
        { bookId: 'GEN', testament: 'OT', order: 1, chapterVerseCounts: [] },
        { bookId: 'gen', testament: 'OT', order: 0, chapterVerseCounts: [2.5] },
      ],
    };
    const codes = new Set(validateBibleData(bad).map((p) => p.code));
    expect(codes).toEqual(
      new Set(['MISSING_VERSION', 'BAD_VERSE_COUNT', 'DUPLICATE_BOOK_ID', 'DUPLICATE_ORDER', 'NO_CHAPTERS', 'BAD_BOOK_ID', 'BAD_ORDER']),
    );
  });

  it('listBooks는 정경 순서(order)로 돌려준다', () => {
    const shuffled: BibleData = { ...SAMPLE_BIBLE, books: [...SAMPLE_BIBLE.books].reverse() };
    expect(listBooks(shuffled).map((b) => b.bookId)).toEqual(['GEN', 'PSA', 'OBA', 'MAT', 'JHN']);
    expect(listBooks(SAMPLE_BIBLE)[3]).toEqual({ bookId: 'MAT', testament: 'NT', order: 40 });
  });
});
