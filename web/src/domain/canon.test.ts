import { describe, expect, it } from 'vitest';
import { BOOKS } from '../i18n/books';
import { SAMPLE_BIBLE } from '../data/sampleBible';
import { CANON_TOTALS, validateAgainstCanon, validateBibleData, validateCanonList } from './bibleData';
import type { BibleData } from './types';

// web-experience의 i18n 책 표(66권 bookId·순서·구약/신약)와 domain 데이터가 1:1로 맞는지 대조한다. (T10 사전 준비)

const canon = BOOKS.map((b) => ({ bookId: b.bookId as string, testament: b.testament as 'OT' | 'NT' }));

/** 절 수는 의미 없는 자리표시(실제 데이터 아님). 정경 대조 검사 자체를 시험하기 위한 골격이다. */
const skeleton = (): BibleData => ({
  dataVersion: 'skeleton',
  versificationSystem: 'skeleton',
  books: canon.map((b, i) => ({ ...b, order: i + 1, chapterVerseCounts: [1] })),
});

describe('정경 목록(i18n 책 표) 대조', () => {
  it('66권, 구약 39 / 신약 27, 중복·형식 오류 없음, 구약이 먼저', () => {
    expect(canon).toHaveLength(CANON_TOTALS.books);
    expect(canon.filter((b) => b.testament === 'OT')).toHaveLength(CANON_TOTALS.ot);
    expect(canon.filter((b) => b.testament === 'NT')).toHaveLength(CANON_TOTALS.nt);
    expect(new Set(canon.map((b) => b.bookId)).size).toBe(66);
    expect(validateCanonList(canon)).toEqual([]);
  });

  it('정경 첫·끝과 USFM 특수 표기(SNG, EZK, JOL, NAM, PHP, 1JN)의 자리', () => {
    const pos = (id: string): number => canon.findIndex((b) => b.bookId === id) + 1;
    expect([pos('GEN'), pos('MAL'), pos('MAT'), pos('REV')]).toEqual([1, 39, 40, 66]);
    expect([pos('SNG'), pos('EZK'), pos('JOL'), pos('NAM'), pos('PHP'), pos('1JN')]).toEqual([22, 26, 29, 34, 50, 62]);
  });

  it('정경 목록 검사가 잘못된 목록을 잡는다', () => {
    const codes = (l: typeof canon): string[] => validateCanonList(l).map((p) => p.code);
    expect(codes(canon.slice(1))).toContain('CANON_LIST'); // 65권
    expect(codes([...canon, canon[0]!])).toContain('DUPLICATE_BOOK_ID');
    expect(codes([...canon].reverse())).toContain('CANON_LIST'); // NT가 앞
    expect(codes(canon.map((b, i) => (i === 0 ? { ...b, bookId: 'gen' } : b)))).toContain('BAD_BOOK_ID');
    expect(codes(canon.map((b, i) => (i === 38 ? { ...b, testament: 'NT' as const } : b)))).toContain('CANON_LIST');
  });

  it('완전한 골격 데이터는 전체 대조를 통과하고 무결성·합계 검사도 통과한다', () => {
    const b = skeleton();
    expect(validateAgainstCanon(b, canon, true)).toEqual([]);
    expect(validateBibleData(b, { books: 66 })).toEqual([]);
  });

  it('책이 빠지거나 순서·구분이 틀리면 전체 대조가 실패한다', () => {
    const b = skeleton();
    expect(validateAgainstCanon({ ...b, books: b.books.slice(1) }, canon, true).length).toBeGreaterThan(0);
    const swapped = { ...b, books: b.books.map((x) => (x.bookId === 'GEN' ? { ...x, order: 2 } : x.bookId === 'EXO' ? { ...x, order: 1 } : x)) };
    expect(validateAgainstCanon(swapped, canon, true).map((p) => p.code)).toEqual(['CANON_MISMATCH', 'CANON_MISMATCH']);
    const wrongTestament = { ...b, books: b.books.map((x) => (x.bookId === 'REV' ? { ...x, testament: 'OT' as const } : x)) };
    expect(validateAgainstCanon(wrongTestament, canon, true)).toHaveLength(1);
    const unknown = { ...b, books: [...b.books.slice(0, 65), { ...b.books[65]!, bookId: 'XXX' }] };
    expect(validateAgainstCanon(unknown, canon, true).length).toBeGreaterThan(0);
  });

  it('SAMPLE_BIBLE은 정경 부분집합으로서 순서·구분이 실제 정경과 일치한다', () => {
    expect(validateAgainstCanon(SAMPLE_BIBLE, canon, false)).toEqual([]);
    // 전체 대조는 부분집합이므로 실패해야 한다
    expect(validateAgainstCanon(SAMPLE_BIBLE, canon, true).length).toBeGreaterThan(0);
  });
});
