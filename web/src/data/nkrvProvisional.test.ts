// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKS } from '../i18n/books';
import { bibleDataStatus, bibleTotals, canonicalString, validateAgainstCanon, validateBibleData } from '../domain/bibleData';
import { computePlan } from '../domain/plan';
import { subtractRanges, unionRanges, verseCount } from '../domain/ranges';
import { makeRng } from '../domain/testHelpers';
import type { PlanInput, ReadInput, TargetScope, Weekday } from '../domain/types';
import { DEFAULT_BIBLE } from './defaultBible';
import { NKRV_PROVISIONAL, NKRV_PROVISIONAL_CANONICAL_SHA256 } from './nkrvProvisional';
import { SAMPLE_BIBLE } from './sampleBible';

// T10: docs/data-sources.md 9절의 검증값. 개역개정 전수 미검증인 잠정 데이터다.

const canon = BOOKS.map((b) => ({ bookId: b.bookId as string, testament: b.testament as 'OT' | 'NT' }));
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const dataDir = new URL('.', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, dataDir), 'utf8');

/** docs/data-sources.md '참고' 표(SWORD KJV canon 기준 책별 장 수/절 합계). 개역개정 값이 아니라 교차 검증용이다. */
const REFERENCE = `GEN 50/1533, EXO 40/1213, LEV 27/859, NUM 36/1288, DEU 34/959, JOS 24/658, JDG 21/618, RUT 4/85, 1SA 31/810, 2SA 24/695, 1KI 22/816, 2KI 25/719, 1CH 29/942, 2CH 36/822, EZR 10/280, NEH 13/406, EST 10/167, JOB 42/1070, PSA 150/2461, PRO 31/915, ECC 12/222, SNG 8/117, ISA 66/1292, JER 52/1364, LAM 5/154, EZK 48/1273, DAN 12/357, HOS 14/197, JOL 3/73, AMO 9/146, OBA 1/21, JON 4/48, MIC 7/105, NAM 3/47, HAB 3/56, ZEP 3/53, HAG 2/38, ZEC 14/211, MAL 4/55,
MAT 28/1071, MRK 16/678, LUK 24/1151, JHN 21/879, ACT 28/1007, ROM 16/433, 1CO 16/437, 2CO 13/257, GAL 6/149, EPH 6/155, PHP 4/104, COL 4/95, 1TH 5/89, 2TH 3/47, 1TI 6/113, 2TI 4/83, TIT 3/46, PHM 1/25, HEB 13/303, JAS 5/108, 1PE 5/105, 2PE 3/61, 1JN 5/105, 2JN 1/13, 3JN 1/14, JUD 1/25, REV 22/404`;
const reference = new Map(
  REFERENCE.split(',').map((x) => {
    const [id, rest] = x.trim().split(' ') as [string, string];
    const [ch, vs] = rest.split('/').map(Number) as [number, number];
    return [id, { chapters: ch, verses: vs }] as const;
  }),
);

describe('NKRV_PROVISIONAL: 값 검증 (docs/data-sources.md 9-4)', () => {
  const b = NKRV_PROVISIONAL;

  it('provisional임이 버전 문자열에 드러난다', () => {
    expect(b.versificationSystem).toBe('nkrv-provisional-1');
    expect(b.dataVersion).toBe('eng.vrs@71c66cb+REV12=17');
    expect(bibleDataStatus(b)).toBe('provisional');
    expect(bibleDataStatus(SAMPLE_BIBLE)).toBe('sample');
    expect(bibleDataStatus({ ...b, versificationSystem: 'nkrv' })).toBe('confirmed');
  });

  it('66권 1,189장 31,103절(구약 23,145 / 신약 7,958)', () => {
    expect(bibleTotals(b)).toEqual({ books: 66, chapters: 1189, verses: 31103 });
    const sum = (t: 'OT' | 'NT'): number =>
      b.books.filter((x) => x.testament === t).reduce((a, x) => a + x.chapterVerseCounts.reduce((p, q) => p + q, 0), 0);
    expect(sum('OT')).toBe(23145);
    expect(sum('NT')).toBe(7958);
    expect(b.books.filter((x) => x.testament === 'OT').reduce((a, x) => a + x.chapterVerseCounts.length, 0)).toBe(929);
    expect(b.books.filter((x) => x.testament === 'NT').reduce((a, x) => a + x.chapterVerseCounts.length, 0)).toBe(260);
    expect(validateBibleData(b, { books: 66, chapters: 1189, verses: 31103 })).toEqual([]);
  });

  it('정규 문자열의 SHA-256이 문서의 값과 같다', () => {
    expect(NKRV_PROVISIONAL_CANONICAL_SHA256).toBe('06d08cd442227dab417f059804dc042a9039f4decd8ed7c4b69385721e55e3b5');
    expect(sha256(canonicalString(b))).toBe(NKRV_PROVISIONAL_CANONICAL_SHA256);
  });

  it('원본 eng.vrs는 REV 12장이 18이며 덮어쓰면 원본 정규 문자열 해시가 나온다', () => {
    const orig = {
      ...b,
      books: b.books.map((x) =>
        x.bookId === 'REV' ? { ...x, chapterVerseCounts: x.chapterVerseCounts.map((n, i) => (i === 11 ? 18 : n)) } : x,
      ),
    };
    expect(bibleTotals(orig).verses).toBe(31104);
    expect(sha256(canonicalString(orig))).toBe('775d44f2f4228b8a602917de65169d7380a29d5d4dfd7defb9ee40c9effee185');
  });

  it('정경 대조(complete=true): 66권, 순서, 구약/신약이 i18n 책 표와 일치', () => {
    expect(validateAgainstCanon(b, canon, true)).toEqual([]);
  });

  it('덮어쓴 곳과 표본 값: REV 12 = 17, 3JN 1 = 15', () => {
    const chapters = (id: string): ReadonlyArray<number> => b.books.find((x) => x.bookId === id)!.chapterVerseCounts;
    expect(chapters('REV')[11]).toBe(17);
    expect(chapters('3JN')).toEqual([15]);
    expect(chapters('GEN')[0]).toBe(31);
    expect(chapters('PSA')).toHaveLength(150);
    expect(chapters('PSA')[118]).toBe(176);
    expect(chapters('OBA')).toEqual([21]);
  });

  it('SWORD KJV 책별 참고표와 비교하면 차이는 3JN 1장뿐이다(장 수 전부 일치, 절 합계 3JN만 15 대 14)', () => {
    expect(reference.size).toBe(66);
    const diffs: string[] = [];
    for (const book of b.books) {
      const ref = reference.get(book.bookId)!;
      expect(book.chapterVerseCounts.length).toBe(ref.chapters);
      const total = book.chapterVerseCounts.reduce((p, q) => p + q, 0);
      if (total !== ref.verses) diffs.push(`${book.bookId} ${total} vs ${ref.verses}`);
    }
    expect(diffs).toEqual(['3JN 15 vs 14']);
    expect([...reference.values()].reduce((a, x) => a + x.verses, 0)).toBe(31102);
  });

  it('DEFAULT_BIBLE은 잠정 데이터이고 SAMPLE_BIBLE(테스트 전용)이 아니다', () => {
    expect(DEFAULT_BIBLE).toBe(NKRV_PROVISIONAL);
    expect(DEFAULT_BIBLE.dataVersion).not.toBe(SAMPLE_BIBLE.dataVersion);
  });
});

describe('출처·고지 표기', () => {
  it('모듈 머리 주석에 잠정·미검증·출처·수정을 밝힌다', () => {
    const head = read('nkrvProvisional.ts').split('\n\n')[0]!;
    expect(head).toContain('개역개정 전수 미검증');
    expect(head).toContain('71c66cb6ddfa6158919bc9798d124141a8168b14');
    expect(head).toContain('003981c7f43c69b73b60d40a3f35f72e7ee017a686a6fb206f19a1b721157541');
    expect(head).toContain('REV 12장');
    expect(head).toContain('3JN');
  });

  it('THIRD_PARTY_NOTICES에 출처·수정 표기와 MIT 전문이 있다', () => {
    const n = read('THIRD_PARTY_NOTICES.md');
    expect(n).toContain('Modified: REV 12 set to 17.');
    expect(n).toContain('71c66cb6ddfa6158919bc9798d124141a8168b14');
    expect(n).toContain('MIT License');
    expect(n).toContain('Copyright (c) 2019 United Bible Societies Institute for Computer Assisted Publishing');
    expect(n).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it('원본 eng.vrs를 저장소에 두지 않았다', () => {
    expect(() => readFileSync(new URL('eng.vrs', dataDir))).toThrow();
  });
});

describe('실제 66권 규모의 계획 (AC03 AC05 AC06 AC23)', () => {
  const base = (over: Partial<PlanInput> = {}): PlanInput => ({
    bible: DEFAULT_BIBLE,
    target: { kind: 'all' },
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    excludedDates: [],
    distribution: 'verses',
    read: { mode: 'none' },
    ...over,
  });

  for (const distribution of ['verses', 'chapters'] as const) {
    it(`1년(365일) 66권 전체(${distribution}): 모든 장이 한 번씩, 빈 날 없음, 절 합계 일치`, () => {
      const started = performance.now();
      const out = computePlan(base({ distribution }));
      expect(performance.now() - started).toBeLessThan(1000);
      if (!out.ok) throw new Error(JSON.stringify(out.errors));
      const r = out.result;
      expect(r.days).toHaveLength(365);
      expect(r.summary).toMatchObject({ targetChapters: 1189, targetVerses: 31103, remainingVerses: 31103, readingDays: 365, assignedDays: 365 });
      expect(r.days.reduce((a, d) => a + d.verseCount, 0)).toBe(31103);
      expect(r.days.reduce((a, d) => a + d.chapterCount, 0)).toBe(1189);
      expect(r.days.every((d) => d.status === 'assigned' && d.partialChapters.length === 0)).toBe(true);
      // 날짜별 범위를 합하면 전체와 같고 서로 겹치지 않는다
      const all = r.days.flatMap((d) => d.ranges);
      expect(verseCount(DEFAULT_BIBLE, all)).toBe(31103);
      expect(r.dataVersion).toBe('eng.vrs@71c66cb+REV12=17');
      if (distribution === 'chapters') {
        const counts = r.days.map((d) => d.chapterCount);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      }
    });
  }

  it('구약·신약·시편 한 권 등 다양한 범위와 장이 날짜보다 많은 짧은 기간', () => {
    const ot = computePlan(base({ target: { kind: 'ot' } }));
    const nt = computePlan(base({ target: { kind: 'nt' }, endDate: '2027-03-31' }));
    if (!ot.ok || !nt.ok) throw new Error('expected ok');
    expect(ot.result.summary).toMatchObject({ targetChapters: 929, targetVerses: 23145 });
    expect(nt.result.summary).toMatchObject({ targetChapters: 260, targetVerses: 7958, readingDays: 90 });
    // 요한3서(1장)를 30일에: 하루만 배정
    const jn = computePlan(base({ target: { kind: 'books', bookIds: ['3JN'] }, endDate: '2027-01-30' }));
    if (!jn.ok) throw new Error('expected ok');
    expect(jn.result.summary).toMatchObject({ readingDays: 30, assignedDays: 1, targetVerses: 15 });
  });

  it('무작위 입력(시드 고정) 300건: 배정 합계·중복 없음·진행률이 실제 데이터에서도 성립', () => {
    const rng = makeRng(1189);
    const ids = DEFAULT_BIBLE.books.map((x) => x.bookId);
    let okCount = 0;
    for (let i = 0; i < 300; i++) {
      const target: TargetScope =
        rng() < 0.4
          ? { kind: 'all' }
          : rng() < 0.3
            ? { kind: 'nt' }
            : { kind: 'books', bookIds: ids.filter(() => rng() < 0.1).sort(() => rng() - 0.5) };
      const throughBook = ids[Math.floor(rng() * ids.length)]!;
      const book = DEFAULT_BIBLE.books.find((x) => x.bookId === throughBook)!;
      const ch = 1 + Math.floor(rng() * book.chapterVerseCounts.length);
      const readInput: ReadInput =
        rng() < 0.3
          ? { mode: 'none' }
          : { mode: 'continuous', through: { bookId: throughBook, chapter: ch, verse: 1 + Math.floor(rng() * (book.chapterVerseCounts[ch - 1] as number)) } };
      const startDay = 1 + Math.floor(rng() * 28);
      const input = base({
        target,
        read: readInput,
        startDate: `2028-02-${String(startDay).padStart(2, '0')}`,
        endDate: `2028-${String(3 + Math.floor(rng() * 9)).padStart(2, '0')}-${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}`,
        weekdays: ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter(() => rng() < 0.6),
        distribution: rng() < 0.5 ? 'verses' : 'chapters',
        ...(rng() < 0.5 ? { asOf: `2028-0${3 + Math.floor(rng() * 5)}-15` } : {}),
      });
      const out = computePlan(input);
      if (!out.ok) continue;
      okCount++;
      const r = out.result;
      const all = r.days.flatMap((d) => d.ranges);
      const merged = unionRanges(DEFAULT_BIBLE, all, []);
      // 불변식 1·2: 합집합 = 남은 범위, 중복 없음(합 = 합집합 크기)
      expect(subtractRanges(DEFAULT_BIBLE, merged, r.remainingRanges)).toEqual([]);
      expect(subtractRanges(DEFAULT_BIBLE, r.remainingRanges, merged)).toEqual([]);
      expect(r.days.reduce((a, d) => a + d.verseCount, 0)).toBe(verseCount(DEFAULT_BIBLE, all));
      expect(r.summary.remainingVerses).toBe(verseCount(DEFAULT_BIBLE, r.remainingRanges));
      // 불변식 3
      expect(r.summary.targetVerses).toBe(r.summary.readVerses + r.summary.remainingVerses);
      expect(r.summary.progressPct).toBeGreaterThanOrEqual(0);
      expect(r.summary.progressPct).toBeLessThanOrEqual(100);
      // 불변식 7
      expect(computePlan(input)).toEqual(out);
    }
    expect(okCount).toBeGreaterThan(100);
  });
});
