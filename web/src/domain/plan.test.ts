import { describe, expect, it } from 'vitest';
import { SAMPLE_BIBLE } from '../data/sampleBible';
import { computePlan, MAX_PERIOD_DAYS } from './plan';
import { baseInput, expandVerses, mustPlan, range } from './testHelpers';
import type { BibleData, PlanErrorCode, PlanInput } from './types';

// SAMPLE_BIBLE(가짜 절 수): GEN 12·3·20·5·9 / PSA 6·2·40 / OBA 7 / MAT 10·4·17 / JHN 5·25·2 (15장 167절)

function errorCodes(input: PlanInput): PlanErrorCode[] {
  const out = computePlan(input);
  if (out.ok) throw new Error('expected errors');
  return out.errors.map((e) => e.code);
}

const noNT: BibleData = { ...SAMPLE_BIBLE, books: SAMPLE_BIBLE.books.filter((b) => b.testament === 'OT') };

describe('AC03 기간·요일·제외일', () => {
  it('시작일과 마감일을 모두 포함하고 요일·제외일을 반영한다', () => {
    // 2026-01-01 목 ~ 2026-01-10 토, 월~금, 1/5(월) 제외
    const r = mustPlan(baseInput({ weekdays: [1, 2, 3, 4, 5], excludedDates: ['2026-01-05'] }));
    expect(r.days).toHaveLength(10);
    expect(r.days[0]?.date).toBe('2026-01-01');
    expect(r.days[9]?.date).toBe('2026-01-10');
    expect(r.days.map((d) => d.status === 'off')).toEqual([false, false, true, true, true, false, false, false, false, true]);
    expect(r.days.map((d) => d.weekday)).toEqual([4, 5, 6, 0, 1, 2, 3, 4, 5, 6]);
    expect(r.summary.readingDays).toBe(6);
  });

  it('시작일과 마감일이 같아도 하루로 계산한다', () => {
    const r = mustPlan(baseInput({ startDate: '2026-01-01', endDate: '2026-01-01' }));
    expect(r.days).toHaveLength(1);
    expect(r.days[0]?.status).toBe('assigned');
    expect(r.days[0]?.verseCount).toBe(167);
    expect(r.summary.readingDays).toBe(1);
  });

  it('윤년 2월 29일을 하루로 포함하고 평년에는 없다', () => {
    const leap = mustPlan(baseInput({ startDate: '2028-02-27', endDate: '2028-03-02' }));
    expect(leap.days.map((d) => d.date)).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']);
    const plain = mustPlan(baseInput({ startDate: '2026-02-27', endDate: '2026-03-02' }));
    expect(plain.days.map((d) => d.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('제외일이 윤일이면 그날만 off이고 월·연 경계를 넘어도 이어진다', () => {
    const r = mustPlan(baseInput({ startDate: '2027-12-30', endDate: '2028-03-01', excludedDates: ['2028-02-29'] }));
    expect(r.days.find((d) => d.date === '2028-02-29')?.status).toBe('off');
    expect(r.days.find((d) => d.date === '2028-01-01')?.status).toBe('assigned');
    expect(r.days).toHaveLength(2 + 31 + 29 + 1);
    expect(r.summary.readingDays).toBe(2 + 31 + 29 + 1 - 1);
  });

  it('기간 밖 제외일과 중복 제외일은 무시한다', () => {
    const r = mustPlan(baseInput({ excludedDates: ['2025-01-01', '2026-01-03', '2026-01-03', '2027-01-01'] }));
    expect(r.summary.readingDays).toBe(9);
  });
});

describe('AC04 입력 오류', () => {
  it('시작일이 마감일보다 늦으면 START_AFTER_END', () => {
    expect(errorCodes(baseInput({ startDate: '2026-01-10', endDate: '2026-01-09' }))).toEqual(['START_AFTER_END']);
  });

  it('읽기 날짜가 0개이면 NO_READING_DAYS(요일 없음, 요일 불일치, 전부 제외)', () => {
    expect(errorCodes(baseInput({ weekdays: [] }))).toEqual(['NO_READING_DAYS']);
    // 목~금 이틀 동안 월요일만 읽는다
    expect(errorCodes(baseInput({ endDate: '2026-01-02', weekdays: [1] }))).toEqual(['NO_READING_DAYS']);
    expect(errorCodes(baseInput({ endDate: '2026-01-02', excludedDates: ['2026-01-01', '2026-01-02'] }))).toEqual([
      'NO_READING_DAYS',
    ]);
  });

  it('범위가 비면 EMPTY_SCOPE', () => {
    expect(errorCodes(baseInput({ target: { kind: 'books', bookIds: [] } }))).toEqual(['EMPTY_SCOPE']);
    expect(errorCodes(baseInput({ bible: noNT, target: { kind: 'nt' } }))).toEqual(['EMPTY_SCOPE']);
  });

  it('없는 책은 UNKNOWN_BOOK', () => {
    expect(errorCodes(baseInput({ target: { kind: 'books', bookIds: ['GEN', 'ZZZ'] } }))).toEqual(['UNKNOWN_BOOK']);
    expect(errorCodes(baseInput({ read: { mode: 'ranges', ranges: [range('ZZZ', 1, 1, 1, 1)] } }))).toEqual(['UNKNOWN_BOOK']);
    expect(errorCodes(baseInput({ read: { mode: 'continuous', through: { bookId: 'ZZZ', chapter: 1, verse: 1 } } }))).toEqual([
      'UNKNOWN_BOOK',
    ]);
  });

  it('없는 장절이나 start > end는 INVALID_RANGE', () => {
    expect(errorCodes(baseInput({ read: { mode: 'ranges', ranges: [range('GEN', 1, 1, 1, 13)] } }))).toEqual(['INVALID_RANGE']);
    expect(errorCodes(baseInput({ read: { mode: 'ranges', ranges: [range('GEN', 2, 1, 1, 1)] } }))).toEqual(['INVALID_RANGE']);
    expect(errorCodes(baseInput({ read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 6, verse: 1 } } }))).toEqual([
      'INVALID_RANGE',
    ]);
    expect(errorCodes(baseInput({ read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 1, verse: 0 } } }))).toEqual([
      'INVALID_RANGE',
    ]);
  });

  it('잘못된 날짜와 너무 긴 기간을 거부한다', () => {
    expect(errorCodes(baseInput({ startDate: '2026-02-30' }))).toEqual(['INVALID_DATE']);
    expect(errorCodes(baseInput({ endDate: '2026/01/10' }))).toEqual(['INVALID_DATE']);
    expect(errorCodes(baseInput({ asOf: '2026-13-01' }))).toEqual(['INVALID_DATE']);
    expect(errorCodes(baseInput({ excludedDates: ['nope'] }))).toEqual(['INVALID_DATE']);
    expect(errorCodes(baseInput({ endDate: '2036-12-31' }))).toEqual(['PERIOD_TOO_LONG']);
    expect(MAX_PERIOD_DAYS).toBe(3660);
  });

  it('독립된 오류는 함께 알려 준다', () => {
    const codes = errorCodes(
      baseInput({ startDate: '2026-01-10', endDate: '2026-01-01', target: { kind: 'books', bookIds: [] } }),
    );
    expect(codes.sort()).toEqual(['EMPTY_SCOPE', 'START_AFTER_END']);
  });

  it('오류 결과에는 계산 결과가 섞이지 않는다', () => {
    const out = computePlan(baseInput({ weekdays: [] }));
    expect(out).toEqual({ ok: false, errors: [{ code: 'NO_READING_DAYS' }] });
  });
});

describe('목표 범위', () => {
  it('전체·구약·신약·선택한 책의 장과 절 수', () => {
    expect(mustPlan(baseInput()).summary).toMatchObject({ targetChapters: 15, targetVerses: 167 });
    expect(mustPlan(baseInput({ target: { kind: 'ot' } })).summary).toMatchObject({ targetChapters: 9, targetVerses: 104 });
    expect(mustPlan(baseInput({ target: { kind: 'nt' } })).summary).toMatchObject({ targetChapters: 6, targetVerses: 63 });
    expect(mustPlan(baseInput({ target: { kind: 'books', bookIds: ['OBA', 'PSA'] } })).summary).toMatchObject({
      targetChapters: 4,
      targetVerses: 55,
    });
  });

  it('선택한 책은 사용자가 고른 순서로 배정한다', () => {
    const r = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['JHN', 'GEN'] }, endDate: '2026-01-01' }));
    expect(r.remainingRanges.map((x) => x.bookId)).toEqual(['JHN', 'GEN']);
    expect(r.days[0]?.ranges.map((x) => x.bookId)).toEqual(['JHN', 'GEN']);
  });

  it('책 중복 선택은 한 번만 센다', () => {
    const r = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['OBA', 'OBA'] } }));
    expect(r.summary.targetVerses).toBe(7);
  });

  it('데이터 버전과 장절 기준이 결과에 고정된다', () => {
    const r = mustPlan(baseInput());
    expect(r).toMatchObject({ contractVersion: '1', dataVersion: 'sample-0', versificationSystem: 'sample-synthetic-not-real' });
  });
});

describe('AC05 날짜별 범위의 합 = 선택한 범위', () => {
  it('chapters: 15장을 5일에 3장씩, 4일이면 4·4·4·3장', () => {
    const five = mustPlan(baseInput({ distribution: 'chapters', endDate: '2026-01-05' }));
    expect(five.days.map((d) => d.chapterCount)).toEqual([3, 3, 3, 3, 3]);
    const four = mustPlan(baseInput({ distribution: 'chapters', endDate: '2026-01-04' }));
    expect(four.days.map((d) => d.chapterCount)).toEqual([4, 4, 4, 3]);
    expect(four.days[0]?.ranges).toEqual([range('GEN', 1, 1, 4, 5)]);
    expect(four.days[1]?.ranges).toEqual([range('GEN', 5, 1, 5, 9), range('PSA', 1, 1, 3, 40)]);
  });

  it('verses: 절 수가 비슷하도록 나누되 장 끝에서 마친다(GEN 49절)', () => {
    const two = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, endDate: '2026-01-02' }));
    expect(two.days.map((d) => d.ranges)).toEqual([[range('GEN', 1, 1, 2, 3)], [range('GEN', 3, 1, 5, 9)]]);
    expect(two.days.map((d) => d.verseCount)).toEqual([15, 34]);
    const three = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, endDate: '2026-01-03' }));
    expect(three.days.map((d) => d.verseCount)).toEqual([15, 20, 14]);
  });

  it('장을 건너는 연속 범위는 하나의 범위로 합쳐진다', () => {
    const r = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, endDate: '2026-01-01' }));
    expect(r.days[0]?.ranges).toEqual([range('GEN', 1, 1, 5, 9)]);
  });

  it('배분 방식에 따라 같은 범위를 다르게 나눌 수 있다', () => {
    const args: Partial<PlanInput> = { target: { kind: 'books', bookIds: ['GEN'] }, endDate: '2026-01-02' };
    const byChapters = mustPlan(baseInput({ ...args, distribution: 'chapters' }));
    const byVerses = mustPlan(baseInput({ ...args, distribution: 'verses' }));
    expect(byChapters.days.map((d) => d.chapterCount)).toEqual([3, 2]);
    expect(byVerses.days.map((d) => d.chapterCount)).toEqual([2, 3]);
    expect(byChapters.distribution).toBe('chapters');
  });

  it('한 장이 매우 길어도 장을 쪼개지 않는다(PSA 3장 40절)', () => {
    const r = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['PSA'] }, endDate: '2026-01-02' }));
    expect(r.days.map((d) => d.ranges)).toEqual([[range('PSA', 1, 1, 2, 2)], [range('PSA', 3, 1, 3, 40)]]);
  });
});

describe('AC06 장 수보다 날짜가 많을 때', () => {
  it('OBA 1장을 5일에: 첫 날만 배정하고 나머지는 empty', () => {
    const r = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['OBA'] }, endDate: '2026-01-05' }));
    expect(r.days.map((d) => d.status)).toEqual(['assigned', 'empty', 'empty', 'empty', 'empty']);
    expect(r.summary).toMatchObject({ readingDays: 5, assignedDays: 1 });
    expect(r.days[1]).toMatchObject({ ranges: [], verseCount: 0, chapterCount: 0, partialChapters: [] });
  });

  it('두 배분 방식 모두 empty 날을 만들고, 읽지 않는 날은 off로 구분한다', () => {
    for (const distribution of ['chapters', 'verses'] as const) {
      // 3장(PSA)을 목~다음주 화(6일) 중 월·화·목·금만 읽기
      const r = mustPlan(
        baseInput({ target: { kind: 'books', bookIds: ['PSA'] }, endDate: '2026-01-06', weekdays: [1, 2, 4, 5], distribution }),
      );
      expect(r.days.map((d) => d.status)).toEqual(['assigned', 'assigned', 'off', 'off', 'assigned', 'empty']);
    }
  });
});

describe('읽은 범위 입력과 부분 장 (AC23)', () => {
  it('연속 입력: 목표 첫 절부터 through까지를 읽은 것으로 본다', () => {
    const r = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 2, verse: 3 } } }));
    expect(r.summary).toMatchObject({ readVerses: 15, remainingVerses: 34, remainingChapters: 3 });
    expect(r.remainingRanges).toEqual([range('GEN', 3, 1, 5, 9)]);
  });

  it('연속 입력이 여러 책에 걸치면 목표 순서(선택 순서)를 따른다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['JHN', 'GEN'] },
        read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 1, verse: 12 } },
      }),
    );
    expect(r.summary.readVerses).toBe(32 + 12);
    expect(r.remainingRanges).toEqual([range('GEN', 2, 1, 5, 9)]);
  });

  it('부분 장은 그 장의 남은 절만 첫 배정 단위가 된다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['GEN'] },
        read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 1, verse: 5 } },
        endDate: '2026-01-02',
      }),
    );
    expect(r.remainingRanges).toEqual([range('GEN', 1, 6, 5, 9)]);
    expect(r.summary).toMatchObject({ readVerses: 5, remainingVerses: 44, remainingChapters: 5 });
    expect(r.days[0]?.ranges[0]?.start).toEqual({ chapter: 1, verse: 6 });
    expect(r.days[0]?.partialChapters).toEqual([{ bookId: 'GEN', chapter: 1 }]);
    expect(r.days[1]?.partialChapters).toEqual([]);
  });

  it('여러 개별 범위: 겹침은 합집합으로 한 번만 센다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['GEN'] },
        read: { mode: 'ranges', ranges: [range('GEN', 1, 1, 1, 8), range('GEN', 1, 5, 1, 12), range('GEN', 1, 1, 1, 12)] },
      }),
    );
    expect(r.summary.readVerses).toBe(12);
    expect(r.summary.remainingChapters).toBe(4);
  });

  it('건너뛴 범위(장 안에 구멍)는 한 날에 두 조각으로 배정하고 부분 장으로 표시한다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['GEN'] },
        read: { mode: 'ranges', ranges: [range('GEN', 3, 5, 3, 10)] },
        endDate: '2026-01-05',
        distribution: 'chapters',
      }),
    );
    expect(r.summary).toMatchObject({ readVerses: 6, remainingVerses: 43, remainingChapters: 5 });
    const gen3 = r.days.find((d) => d.partialChapters.some((p) => p.chapter === 3));
    expect(gen3?.ranges).toEqual([range('GEN', 3, 1, 3, 4), range('GEN', 3, 11, 3, 20)]);
    expect(gen3?.verseCount).toBe(14);
    expect(gen3?.chapterCount).toBe(1);
    // 그 장의 남은 절이 한 날에만 들어 있다
    expect(r.days.filter((d) => expandVerses(SAMPLE_BIBLE, d.ranges).has('GEN 3:1'))).toHaveLength(1);
  });

  it('진행률은 읽은 절/목표 절이고 100을 넘지 않는다', () => {
    const half = mustPlan(baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 2, verse: 3 } } }));
    expect(half.summary.progressPct).toBeCloseTo((15 / 49) * 100, 10);
    expect(mustPlan(baseInput()).summary.progressPct).toBe(0);
  });

  it('읽은 범위가 목표 밖이면 READ_OUTSIDE_TARGET', () => {
    const ot = { kind: 'ot' } as const;
    expect(errorCodes(baseInput({ target: ot, read: { mode: 'ranges', ranges: [range('JHN', 1, 1, 1, 5)] } }))).toEqual(['READ_OUTSIDE_TARGET']);
    expect(errorCodes(baseInput({ target: ot, read: { mode: 'ranges', ranges: [range('GEN', 1, 1, 1, 5), range('MAT', 1, 1, 1, 1)] } }))).toEqual([
      'READ_OUTSIDE_TARGET',
    ]);
    expect(errorCodes(baseInput({ target: ot, read: { mode: 'continuous', through: { bookId: 'MAT', chapter: 1, verse: 1 } } }))).toEqual([
      'READ_OUTSIDE_TARGET',
    ]);
    expect(errorCodes(baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, read: { mode: 'ranges', ranges: [range('PSA', 1, 1, 1, 1)] } }))).toEqual([
      'READ_OUTSIDE_TARGET',
    ]);
  });
});

describe('모든 범위 소진 (AC23)', () => {
  it('전부 읽었으면 남은 절 0, 진행률 100, 모든 읽기 날짜는 empty', () => {
    const r = mustPlan(baseInput({ read: { mode: 'continuous', through: { bookId: 'JHN', chapter: 3, verse: 2 } } }));
    expect(r.summary).toMatchObject({
      readVerses: 167,
      remainingVerses: 0,
      remainingChapters: 0,
      progressPct: 100,
      readingDays: 10,
      assignedDays: 0,
      avgVersesPerDay: 0,
      todayTarget: null,
    });
    expect(r.remainingRanges).toEqual([]);
    expect(r.days.every((d) => d.status === 'empty')).toBe(true);
  });

  it('개별 범위로 전부 읽은 경우도 같다(겹침 포함)', () => {
    const all = SAMPLE_BIBLE.books.map((b) => range(b.bookId, 1, 1, b.chapterVerseCounts.length, b.chapterVerseCounts.at(-1)!));
    const r = mustPlan(baseInput({ read: { mode: 'ranges', ranges: [...all, range('GEN', 1, 1, 1, 12)] } }));
    expect(r.summary).toMatchObject({ readVerses: 167, remainingVerses: 0, progressPct: 100 });
  });
});

describe('AC08 재계산(asOf)', () => {
  it('asOf 이전 날짜는 elapsed이고 남은 범위를 남은 읽기 날짜에 다시 나눈다', () => {
    const r = mustPlan(baseInput({ asOf: '2026-01-04', target: { kind: 'books', bookIds: ['GEN'] }, distribution: 'chapters' }));
    expect(r.recalculatedFrom).toBe('2026-01-04');
    expect(r.days.map((d) => d.status)).toEqual([
      'elapsed', 'elapsed', 'elapsed', 'assigned', 'assigned', 'assigned', 'assigned', 'assigned', 'empty', 'empty',
    ]);
    expect(r.summary.readingDays).toBe(7);
    expect(r.days.filter((d) => d.status === 'elapsed').every((d) => d.ranges.length === 0 && d.verseCount === 0)).toBe(true);
    expect(r.summary.todayTarget).toEqual({ verses: 12, ranges: [range('GEN', 1, 1, 1, 12)] });
  });

  it('elapsed 날짜에 읽음/못 읽음을 추정하지 않는다: 읽은 범위는 입력값뿐', () => {
    const r = mustPlan(baseInput({ asOf: '2026-01-09' }));
    expect(r.summary.readVerses).toBe(0);
    expect(r.summary.progressPct).toBe(0);
    expect(r.summary.remainingVerses).toBe(167);
  });

  it('요일과 관계없이 asOf 이전은 elapsed이다(off보다 우선)', () => {
    const r = mustPlan(baseInput({ asOf: '2026-01-06', weekdays: [1, 2, 3, 4, 5] }));
    expect(r.days.slice(0, 5).map((d) => d.status)).toEqual(['elapsed', 'elapsed', 'elapsed', 'elapsed', 'elapsed']);
  });

  it('시작일이 미래이면 시작일부터 계산하고 최초 계획으로 표시한다', () => {
    const r = mustPlan(baseInput({ asOf: '2025-12-20' }));
    expect(r.recalculatedFrom).toBeNull();
    expect(r.summary.readingDays).toBe(10);
    expect(r.summary.todayTarget).toBeNull();
    expect(r.days.some((d) => d.status === 'elapsed')).toBe(false);
  });

  it('asOf가 시작일이면 최초 계획과 같고 오늘 목표는 첫날의 배정이다', () => {
    const r = mustPlan(baseInput({ asOf: '2026-01-01' }));
    expect(r.recalculatedFrom).toBeNull();
    expect(r.summary.todayTarget?.ranges).toEqual(r.days[0]?.ranges);
    expect(r.summary.todayTarget?.verses).toBe(r.days[0]?.verseCount);
  });

  it('asOf가 마감일이면 남은 전부를 마감일 하루에 배정한다', () => {
    const r = mustPlan(baseInput({ asOf: '2026-01-10' }));
    expect(r.summary.readingDays).toBe(1);
    expect(r.days[9]?.verseCount).toBe(167);
    expect(r.days.slice(0, 9).every((d) => d.status === 'elapsed')).toBe(true);
  });

  it('asOf 이후 읽기 날짜가 0개인데 미독이 있으면 NO_DAYS_LEFT_WITH_REMAINING', () => {
    expect(errorCodes(baseInput({ asOf: '2026-01-11' }))).toEqual(['NO_DAYS_LEFT_WITH_REMAINING']);
    // 목요일만 읽는 기간(1/1~1/7)에서 1/2 이후에는 읽을 날이 없다
    const thursdayOnly = { endDate: '2026-01-07', weekdays: [4] as [4] };
    expect(mustPlan(baseInput(thursdayOnly)).summary.readingDays).toBe(1);
    expect(errorCodes(baseInput({ ...thursdayOnly, asOf: '2026-01-02' }))).toEqual(['NO_DAYS_LEFT_WITH_REMAINING']);
  });

  it('asOf 이후 읽기 날짜가 없어도 미독이 0이면 오류가 아니다', () => {
    const r = mustPlan(baseInput({ asOf: '2026-02-01', read: { mode: 'continuous', through: { bookId: 'JHN', chapter: 3, verse: 2 } } }));
    expect(r.summary).toMatchObject({ readingDays: 0, remainingVerses: 0, avgVersesPerDay: null, todayTarget: null });
    expect(r.days.every((d) => d.status === 'elapsed')).toBe(true);
  });

  it('현재 화면 조건만 사용하고 이전 계산이 다음 계산에 남지 않는다', () => {
    const a = baseInput({ asOf: '2026-01-04', read: { mode: 'ranges', ranges: [range('GEN', 1, 1, 1, 12)] } });
    const before = computePlan(a);
    computePlan(baseInput({ asOf: '2026-01-09', target: { kind: 'nt' } }));
    expect(computePlan(a)).toEqual(before);
    // 조건을 바꾸면 결과가 바뀐다
    expect(computePlan({ ...a, endDate: '2026-01-20' })).not.toEqual(before);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const input = baseInput({
      asOf: '2026-01-04',
      excludedDates: ['2026-01-06'],
      read: { mode: 'ranges', ranges: [range('GEN', 1, 5, 1, 8), range('GEN', 1, 1, 1, 6)] },
      todayRead: [range('GEN', 2, 1, 2, 3)],
    });
    const copy = structuredClone(input);
    computePlan(input);
    expect(input).toEqual(copy);
  });
});

describe('AC24 오늘 달성률', () => {
  const gen2days = (over: Partial<PlanInput> = {}): PlanInput =>
    baseInput({ target: { kind: 'books', bookIds: ['GEN'] }, endDate: '2026-01-02', asOf: '2026-01-01', ...over });

  it('오늘 읽은 범위를 입력하지 않으면 0%가 아니라 null', () => {
    expect(mustPlan(gen2days()).summary.todayAchievementPct).toBeNull();
    expect(mustPlan(gen2days({ todayRead: [] })).summary.todayAchievementPct).toBeNull();
    expect(mustPlan(gen2days()).summary.todayTarget?.verses).toBe(15);
  });

  it('입력한 범위 중 오늘 목표에 속한 절의 비율', () => {
    // 오늘 목표 GEN 1:1–2:3 (15절)
    expect(mustPlan(gen2days({ todayRead: [range('GEN', 1, 1, 1, 12)] })).summary.todayAchievementPct).toBeCloseTo(80, 10);
    expect(mustPlan(gen2days({ todayRead: [range('GEN', 1, 1, 2, 3)] })).summary.todayAchievementPct).toBe(100);
    expect(mustPlan(gen2days({ todayRead: [range('GEN', 1, 1, 1, 6), range('GEN', 1, 4, 1, 12)] })).summary.todayAchievementPct).toBeCloseTo(80, 10);
  });

  it('오늘 목표 밖의 읽은 범위는 분자에 넣지 않고 100을 넘지 않는다', () => {
    expect(mustPlan(gen2days({ todayRead: [range('GEN', 5, 1, 5, 9)] })).summary.todayAchievementPct).toBe(0);
    expect(mustPlan(gen2days({ todayRead: [range('GEN', 1, 1, 5, 9)] })).summary.todayAchievementPct).toBe(100);
  });

  it('입력한 범위가 목표 자체 밖이면 READ_OUTSIDE_TARGET', () => {
    expect(errorCodes(gen2days({ todayRead: [range('PSA', 1, 1, 1, 1)] }))).toEqual(['READ_OUTSIDE_TARGET']);
    expect(errorCodes(gen2days({ todayRead: [range('GEN', 9, 1, 9, 1)] }))).toEqual(['INVALID_RANGE']);
  });

  it('오늘 목표가 없으면 null이고 0으로 나누지 않는다', () => {
    // asOf 없음
    const noAsOf = mustPlan(gen2days({ asOf: undefined, todayRead: [range('GEN', 1, 1, 1, 12)] }));
    expect(noAsOf.summary.todayTarget).toBeNull();
    expect(noAsOf.summary.todayAchievementPct).toBeNull();
    // 오늘이 off
    const offDay = mustPlan(gen2days({ weekdays: [5], startDate: '2026-01-01', endDate: '2026-01-02', todayRead: [range('GEN', 1, 1, 1, 12)] }));
    expect(offDay.days[0]?.status).toBe('off');
    expect(offDay.summary.todayAchievementPct).toBeNull();
    // 전부 읽은 뒤
    const done = mustPlan(gen2days({ read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 5, verse: 9 } }, todayRead: [range('GEN', 1, 1, 1, 1)] }));
    expect(done.summary.todayTarget).toBeNull();
    expect(done.summary.todayAchievementPct).toBeNull();
    for (const r of [noAsOf, offDay, done]) expect(Number.isNaN(r.summary.todayAchievementPct ?? 0)).toBe(false);
  });

  it('오늘 읽은 범위는 오늘 목표의 분모와 배정 자체를 바꾸지 않는다', () => {
    const without = mustPlan(gen2days());
    const withToday = mustPlan(gen2days({ todayRead: [range('GEN', 1, 1, 1, 12)] }));
    expect(withToday.days).toEqual(without.days);
    expect(withToday.summary.todayTarget).toEqual(without.summary.todayTarget);
    expect(withToday.summary.readVerses).toBe(0);
  });
});

describe('평균 하루 분량', () => {
  it('남은 절 / 읽기 날짜 수, 읽기 날짜가 0이면 null', () => {
    expect(mustPlan(baseInput()).summary.avgVersesPerDay).toBeCloseTo(16.7, 10);
    const done = mustPlan(baseInput({ asOf: '2026-02-01', read: { mode: 'continuous', through: { bookId: 'JHN', chapter: 3, verse: 2 } } }));
    expect(done.summary.avgVersesPerDay).toBeNull();
  });
});

describe('규모 (합성 데이터, 실제 성경 아님)', () => {
  it('66권·1189장 규모와 최대 기간(3660일)도 즉시 계산한다', () => {
    const books = Array.from({ length: 66 }, (_, i) => ({
      bookId: `B${String(i).padStart(2, '0')}`,
      testament: i < 39 ? ('OT' as const) : ('NT' as const),
      order: i + 1,
      chapterVerseCounts: Array.from({ length: i < 65 ? 18 : 19 }, (_, c) => 5 + ((i * 7 + c * 13) % 40)),
    }));
    const bible: BibleData = { dataVersion: 'synthetic', versificationSystem: 'synthetic', books };
    const started = performance.now();
    const r = mustPlan(baseInput({ bible, startDate: '2026-01-01', endDate: '2035-12-30', asOf: '2026-06-01' }));
    expect(performance.now() - started).toBeLessThan(1500);
    expect(r.days).toHaveLength(3651);
    expect(r.days.reduce((a, d) => a + d.verseCount, 0)).toBe(r.summary.targetVerses);
  });
});

describe('선택한 책 순서와 읽은 범위 조합', () => {
  it('연속 입력의 through가 선택 순서상 첫 책이면 그 책 안에서만 읽은 것이고 나머지는 선택 순서로 남는다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['JHN', 'GEN'] },
        read: { mode: 'continuous', through: { bookId: 'JHN', chapter: 2, verse: 10 } },
      }),
    );
    expect(r.summary.readVerses).toBe(5 + 10);
    expect(r.remainingRanges).toEqual([range('JHN', 2, 11, 3, 2), range('GEN', 1, 1, 5, 9)]);
    expect(r.summary.remainingChapters).toBe(2 + 5);
  });

  it('선택 순서에서 뒤인 책의 through는 정경 순서가 앞이어도 그 앞 책 전체를 읽은 것으로 본다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['MAT', 'GEN', 'PSA'] },
        read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 1, verse: 1 } },
      }),
    );
    expect(r.summary.readVerses).toBe(31 + 1);
    expect(r.remainingRanges).toEqual([range('GEN', 1, 2, 5, 9), range('PSA', 1, 1, 3, 40)]);
  });

  it('개별 범위 입력도 남은 범위는 선택 순서를 따른다', () => {
    const r = mustPlan(
      baseInput({
        target: { kind: 'books', bookIds: ['PSA', 'GEN'] },
        read: { mode: 'ranges', ranges: [range('GEN', 1, 1, 1, 12), range('PSA', 3, 1, 3, 40)] },
      }),
    );
    expect(r.remainingRanges).toEqual([range('PSA', 1, 1, 2, 2), range('GEN', 2, 1, 5, 9)]);
  });

  it('오늘 읽은 범위가 오늘 목표의 책 경계를 걸쳐도 절 단위로 센다(AC24)', () => {
    // 하루에 JHN 끝 + GEN 앞부분을 읽는 계획
    const input = baseInput({
      target: { kind: 'books', bookIds: ['JHN', 'GEN'] },
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      asOf: '2026-01-01',
      todayRead: [range('JHN', 3, 1, 3, 2), range('GEN', 1, 1, 1, 12)],
    });
    const r = mustPlan(input);
    expect(r.summary.todayTarget?.verses).toBe(81);
    expect(r.summary.todayAchievementPct).toBeCloseTo(((2 + 12) * 100) / 81, 10);
  });
});
