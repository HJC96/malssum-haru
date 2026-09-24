import { describe, expect, it } from 'vitest';
import { SAMPLE_BIBLE } from '../data/sampleBible';
import { intersectRanges, isPartialChapter, isWithin, normalizeRanges, subtractRanges, unionRanges, validateRange, verseCount } from './ranges';
import { formatRange } from './format';
import { expandVerses, makeRng, range } from './testHelpers';
import type { VerseRange } from './types';

const B = SAMPLE_BIBLE;

describe('범위 집합 연산 (AC23: 중복 없는 절 수, 목표 안/밖)', () => {
  it('겹치는 범위는 합집합으로 한 번만 센다', () => {
    const a = range('GEN', 1, 1, 1, 8);
    const b = range('GEN', 1, 5, 2, 2);
    expect(verseCount(B, [a, b])).toBe(12 + 2); // 1:1–1:12, 2:1–2:2
    expect(unionRanges(B, [a], [b])).toEqual([range('GEN', 1, 1, 2, 2)]);
  });

  it('맞닿은 범위(장 경계 포함)를 하나로 합친다', () => {
    expect(normalizeRanges(B, [range('GEN', 1, 7, 1, 12), range('GEN', 2, 1, 2, 3), range('GEN', 1, 1, 1, 6)])).toEqual([
      range('GEN', 1, 1, 2, 3),
    ]);
  });

  it('책이 다르면 합치지 않고 책 순서로 돌려준다', () => {
    expect(normalizeRanges(B, [range('JHN', 1, 1, 1, 5), range('GEN', 5, 1, 5, 9)])).toEqual([
      range('GEN', 5, 1, 5, 9),
      range('JHN', 1, 1, 1, 5),
    ]);
  });

  it('차집합은 절 단위로 정확하다(장 중간을 자른다)', () => {
    const out = subtractRanges(B, [range('GEN', 1, 1, 2, 3)], [range('GEN', 1, 5, 1, 8)]);
    expect(out).toEqual([range('GEN', 1, 1, 1, 4), range('GEN', 1, 9, 2, 3)]);
    expect(verseCount(B, out)).toBe(15 - 4);
  });

  it('교집합과 목표 안/밖 판정', () => {
    const target = [range('GEN', 1, 1, 5, 9)];
    expect(intersectRanges(B, [range('GEN', 4, 3, 5, 3)], target)).toEqual([range('GEN', 4, 3, 5, 3)]);
    expect(isWithin(B, [range('GEN', 2, 1, 2, 3)], target)).toBe(true);
    expect(isWithin(B, [range('GEN', 2, 1, 2, 3), range('PSA', 1, 1, 1, 1)], target)).toBe(false);
    expect(intersectRanges(B, [range('PSA', 1, 1, 1, 6)], target)).toEqual([]);
  });

  it('한 절짜리와 책 전체 범위를 다룬다', () => {
    expect(verseCount(B, [range('OBA', 1, 3, 1, 3)])).toBe(1);
    expect(verseCount(B, [range('PSA', 1, 1, 3, 40)])).toBe(48);
  });

  it('잘못된 범위를 구분한다(UNKNOWN_BOOK, INVALID_RANGE)', () => {
    expect(validateRange(B, range('XXX', 1, 1, 1, 1))).toBe('UNKNOWN_BOOK');
    expect(validateRange(B, range('GEN', 6, 1, 6, 1))).toBe('INVALID_RANGE'); // 없는 장
    expect(validateRange(B, range('GEN', 2, 4, 2, 4))).toBe('INVALID_RANGE'); // 없는 절
    expect(validateRange(B, range('GEN', 0, 1, 1, 1))).toBe('INVALID_RANGE');
    expect(validateRange(B, range('GEN', 1, 5, 1, 4))).toBe('INVALID_RANGE'); // start > end
    expect(validateRange(B, range('GEN', 2, 1, 1, 12))).toBe('INVALID_RANGE');
    expect(validateRange(B, range('GEN', 1, 1.5, 1, 4))).toBe('INVALID_RANGE');
    expect(validateRange(B, range('GEN', 1, 1, 1, 12))).toBeNull();
    expect(() => verseCount(B, [range('GEN', 9, 1, 9, 1)])).toThrow(RangeError);
  });

  it('부분 장을 판정한다', () => {
    expect(isPartialChapter(B, [range('GEN', 1, 1, 1, 5)], 'GEN', 1)).toBe(true);
    expect(isPartialChapter(B, [range('GEN', 1, 1, 1, 12)], 'GEN', 1)).toBe(false);
    expect(isPartialChapter(B, [range('GEN', 2, 1, 2, 3)], 'GEN', 1)).toBe(false);
    expect(isPartialChapter(B, [range('GEN', 1, 1, 1, 5)], 'GEN', 99)).toBe(false);
  });

  it('무작위 범위: 절을 하나씩 펼친 집합 연산과 항상 일치한다(시드 고정)', () => {
    const rng = makeRng(20260924);
    const randomRange = (): VerseRange => {
      const book = B.books[Math.floor(rng() * B.books.length)]!;
      const flat: Array<[number, number]> = [];
      book.chapterVerseCounts.forEach((n, i) => {
        for (let v = 1; v <= n; v++) flat.push([i + 1, v]);
      });
      const i = Math.floor(rng() * flat.length);
      const j = Math.min(flat.length - 1, i + Math.floor(rng() * 20));
      const [c1, v1] = flat[i]!;
      const [c2, v2] = flat[j]!;
      return range(book.bookId, c1, v1, c2, v2);
    };
    for (let iter = 0; iter < 300; iter++) {
      const a = Array.from({ length: Math.floor(rng() * 4) }, randomRange);
      const b = Array.from({ length: Math.floor(rng() * 4) }, randomRange);
      const sa = expandVerses(B, a);
      const sb = expandVerses(B, b);
      const u = new Set([...sa, ...sb]);
      const d = new Set([...sa].filter((x) => !sb.has(x)));
      const i = new Set([...sa].filter((x) => sb.has(x)));
      expect(expandVerses(B, unionRanges(B, a, b))).toEqual(u);
      expect(expandVerses(B, subtractRanges(B, a, b))).toEqual(d);
      expect(expandVerses(B, intersectRanges(B, a, b))).toEqual(i);
      expect(verseCount(B, a)).toBe(sa.size);
      expect(isWithin(B, a, b)).toBe(d.size === 0);
      // 정규화 결과는 겹치거나 맞닿지 않는다: 다시 정규화해도 같다
      const norm = normalizeRanges(B, a);
      expect(normalizeRanges(B, norm)).toEqual(norm);
    }
  });
});

describe('formatRange', () => {
  const name = (id: string): string => ({ JHN: '요한복음', GEN: '창세기' })[id] ?? id;
  it('장을 건너는 범위, 같은 장, 한 절', () => {
    expect(formatRange(range('JHN', 3, 1, 4, 54), name)).toBe('요한복음 3:1–4:54');
    expect(formatRange(range('JHN', 3, 1, 3, 16), name)).toBe('요한복음 3:1–16');
    expect(formatRange(range('JHN', 3, 16, 3, 16), name)).toBe('요한복음 3:16');
  });
});
