import { computePlan, SAMPLE_BIBLE } from '@/domain';
import { baselineInput, buildPlanInput, computeFromForm, defaultForm, emptyRange, type PlanFormState } from './planForm';
import { todayState } from './todayProgress';

const TODAY = '2026-09-24';
const form = (over: Partial<PlanFormState> = {}): PlanFormState => ({ ...defaultForm(TODAY), endDate: '2026-10-23', ...over });
const row = (bookId: string, sc: string, sv: string, ec: string, ev: string) => ({
  bookId,
  startChapter: sc,
  startVerse: sv,
  endChapter: ec,
  endVerse: ev,
});

describe('defaultForm', () => {
  it('오늘부터 365일, 매일, 절 수 배분, 처음 시작', () => {
    const f = defaultForm(TODAY);
    expect(f.startDate).toBe('2026-09-24');
    expect(f.endDate).toBe('2027-09-23');
    expect(f.weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(f.distribution).toBe('verses');
    expect(f.readMode).toBe('none');
    expect(f.recalc).toBe(false);
  });
});

describe('buildPlanInput', () => {
  it('선택한 책은 배열 순서를 읽는 순서로 넘긴다', () => {
    const r = buildPlanInput(form({ scopeKind: 'books', bookIds: ['MAT', 'GEN'] }), SAMPLE_BIBLE, TODAY);
    expect(r.ok && r.input.target).toEqual({ kind: 'books', bookIds: ['MAT', 'GEN'] });
  });

  it('재계산을 켜면 오늘을 asOf로 넘기고, 끄면 넘기지 않는다', () => {
    const on = buildPlanInput(form({ recalc: true }), SAMPLE_BIBLE, TODAY);
    const off = buildPlanInput(form(), SAMPLE_BIBLE, TODAY);
    expect(on.ok && on.input.asOf).toBe(TODAY);
    expect(off.ok && 'asOf' in off.input).toBe(false);
  });

  it('오늘 읽은 범위는 read에 합치지 않고 todayRead로만 넘긴다', () => {
    const r = buildPlanInput(form({ todayRead: [row('GEN', '1', '1', '1', '3')] }), SAMPLE_BIBLE, TODAY);
    expect(r.ok && r.input.todayRead).toEqual([{ bookId: 'GEN', start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 3 } }]);
    expect(r.ok && r.input.read).toEqual({ mode: 'none' });
  });

  it('오늘 읽은 범위가 비어 있으면 todayRead 자체를 넘기지 않는다(미입력)', () => {
    const r = buildPlanInput(form({ todayRead: [emptyRange()] }), SAMPLE_BIBLE, TODAY);
    expect(r.ok && 'todayRead' in r.input).toBe(false);
  });

  it('연속 입력과 개별 범위 입력을 모두 만든다 (AC26)', () => {
    const c = buildPlanInput(form({ readMode: 'continuous', through: { bookId: 'GEN', chapter: '2', verse: '3' } }), SAMPLE_BIBLE, TODAY);
    expect(c.ok && c.input.read).toEqual({ mode: 'continuous', through: { bookId: 'GEN', chapter: 2, verse: 3 } });
    const r = buildPlanInput(form({ readMode: 'ranges', readRanges: [row('GEN', '1', '1', '1', '5'), emptyRange(), row('MAT', '1', '1', '2', '4')] }), SAMPLE_BIBLE, TODAY);
    expect(r.ok && r.input.read.mode).toBe('ranges');
    expect(r.ok && r.input.read.mode === 'ranges' && r.input.read.ranges).toHaveLength(2); // 빈 행은 무시
  });

  it('채우다 만 행과 정수가 아닌 값은 오류로 알린다', () => {
    const inc = buildPlanInput(form({ readMode: 'ranges', readRanges: [row('GEN', '1', '', '1', '5')] }), SAMPLE_BIBLE, TODAY);
    expect(!inc.ok && inc.issues).toEqual([{ code: 'FORM_INCOMPLETE', field: 'read' }]);
    for (const bad of ['0', '-1', '1.5', 'abc', '01']) {
      const r = buildPlanInput(form({ readMode: 'ranges', readRanges: [row('GEN', bad, '1', '1', '5')] }), SAMPLE_BIBLE, TODAY);
      expect(!r.ok && r.issues[0]?.code).toBe('FORM_NOT_INTEGER');
    }
    const through = buildPlanInput(form({ readMode: 'continuous', through: { bookId: '', chapter: '', verse: '' } }), SAMPLE_BIBLE, TODAY);
    expect(!through.ok && through.issues[0]?.code).toBe('FORM_INCOMPLETE');
    const today = buildPlanInput(form({ todayRead: [row('', '1', '1', '1', '1')] }), SAMPLE_BIBLE, TODAY);
    expect(!today.ok && today.issues).toEqual([{ code: 'FORM_INCOMPLETE', field: 'todayRead' }]);
  });

  it('폼 상태를 바꾸지 않는다', () => {
    const f = form({ scopeKind: 'books', bookIds: ['GEN'], weekdays: [1, 3] });
    const snapshot = JSON.stringify(f);
    buildPlanInput(f, SAMPLE_BIBLE, TODAY);
    expect(JSON.stringify(f)).toBe(snapshot);
  });
});

describe('computeFromForm: 오류 안내 (AC04)', () => {
  const codes = (f: PlanFormState) => {
    const c = computeFromForm(f, SAMPLE_BIBLE, TODAY);
    return c.ok ? [] : c.issues.map((i) => i.code);
  };

  it('시작일이 마감일보다 늦다', () => {
    expect(codes(form({ startDate: '2026-11-01', endDate: '2026-10-01' }))).toContain('START_AFTER_END');
  });
  it('읽는 요일이 없다', () => {
    expect(codes(form({ weekdays: [] }))).toContain('NO_READING_DAYS');
  });
  it('제외일이 모든 읽기 날짜를 덮는다', () => {
    expect(codes(form({ startDate: '2026-10-01', endDate: '2026-10-01', excludedDates: ['2026-10-01'] }))).toContain('NO_READING_DAYS');
  });
  it('책을 고르지 않았다', () => {
    expect(codes(form({ scopeKind: 'books', bookIds: [] }))).toContain('EMPTY_SCOPE');
  });
  it('날짜가 비었거나 실제 날짜가 아니다', () => {
    expect(codes(form({ startDate: '' }))).toContain('INVALID_DATE');
    expect(codes(form({ endDate: '2026-02-30' }))).toContain('INVALID_DATE');
  });
  it('기간이 너무 길다', () => {
    expect(codes(form({ startDate: '2000-01-01', endDate: '2026-01-01' }))).toContain('PERIOD_TOO_LONG');
  });
  it('읽은 범위가 목표 밖이다', () => {
    const f = form({ scopeKind: 'books', bookIds: ['GEN'], readMode: 'continuous', through: { bookId: 'MAT', chapter: '1', verse: '1' } });
    expect(codes(f)).toContain('READ_OUTSIDE_TARGET');
  });
  it('없는 장절이다', () => {
    expect(codes(form({ readMode: 'continuous', through: { bookId: 'GEN', chapter: '99', verse: '1' } }))).toContain('INVALID_RANGE');
  });
  it('오늘 이후 읽기 날짜가 없는데 미독이 남으면 마감일 변경을 안내한다', () => {
    const f = form({ startDate: '2026-08-01', endDate: '2026-09-01', recalc: true });
    const c = computeFromForm(f, SAMPLE_BIBLE, TODAY);
    expect(!c.ok && c.issues.map((i) => i.code)).toEqual(['NO_DAYS_LEFT_WITH_REMAINING']);
  });
  it('오류에는 어느 입력의 문제인지(field)가 담긴다', () => {
    const c = computeFromForm(form({ readMode: 'continuous', through: { bookId: 'GEN', chapter: '99', verse: '1' } }), SAMPLE_BIBLE, TODAY);
    expect(!c.ok && c.issues[0]).toMatchObject({ code: 'INVALID_RANGE', field: 'read' });
  });
});

describe('읽은 범위 (AC23, AC26)', () => {
  const readVerses = (f: PlanFormState) => {
    const c = computeFromForm(f, SAMPLE_BIBLE, TODAY);
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    return c.outcome.result.summary.readVerses;
  };

  it('겹치는 범위는 한 번만 센다', () => {
    const overlapping = readVerses(form({ readMode: 'ranges', readRanges: [row('GEN', '1', '1', '1', '8'), row('GEN', '1', '5', '2', '2')] }));
    const merged = readVerses(form({ readMode: 'ranges', readRanges: [row('GEN', '1', '1', '2', '2')] }));
    expect(overlapping).toBe(merged);
    expect(merged).toBe(12 + 2); // GEN 1장 12절 + 2장 2절
  });

  it('연속 입력은 목표의 처음부터 지정 위치까지와 같다', () => {
    const continuous = readVerses(form({ readMode: 'continuous', through: { bookId: 'GEN', chapter: '2', verse: '2' } }));
    const ranges = readVerses(form({ readMode: 'ranges', readRanges: [row('GEN', '1', '1', '2', '2')] }));
    expect(continuous).toBe(ranges);
  });
});

describe('todayState: 오늘 목표와 달성률 (AC24)', () => {
  const plan = (f: PlanFormState) => {
    const c = computeFromForm(f, SAMPLE_BIBLE, TODAY);
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    return c;
  };

  it('오늘 읽은 범위를 입력하지 않으면 미입력이고 0%가 아니다', () => {
    const c = plan(form());
    const s = todayState(c.outcome.result, SAMPLE_BIBLE, TODAY, []);
    expect(s.kind).toBe('not-entered');
  });

  it('입력하면 오늘 배정 중 읽은 비율을 계산한다 (재계산 없이도)', () => {
    const c = plan(form({ todayRead: [row('GEN', '1', '1', '1', '6')] }));
    const today = c.outcome.result.days.find((d) => d.date === TODAY)!;
    expect(today.ranges[0]).toMatchObject({ bookId: 'GEN', start: { chapter: 1, verse: 1 } });
    const s = todayState(c.outcome.result, SAMPLE_BIBLE, TODAY, c.input.todayRead ?? []);
    expect(s.kind).toBe('entered');
    expect(s.kind === 'entered' && s.pct).toBeCloseTo((6 * 100) / today.verseCount, 6);
  });

  it('오늘 배정이 없으면(쉬는 날·기간 밖) 오늘 목표 없음이며 0으로 나누지 않는다', () => {
    const off = plan(form({ weekdays: [0, 1, 2, 3, 5, 6] })); // 2026-09-24는 목요일(4)
    expect(todayState(off.outcome.result, SAMPLE_BIBLE, TODAY, []).kind).toBe('no-target');
    const later = plan(form({ startDate: '2026-10-01', endDate: '2026-10-31' }));
    expect(todayState(later.outcome.result, SAMPLE_BIBLE, TODAY, []).kind).toBe('no-target');
  });

  it('재계산 모드에서는 domain의 todayAchievementPct와 같은 값이다', () => {
    const c = plan(form({ recalc: true, todayRead: [row('GEN', '1', '1', '1', '6')] }));
    const s = todayState(c.outcome.result, SAMPLE_BIBLE, TODAY, c.input.todayRead ?? []);
    expect(s.kind === 'entered' && s.pct).toBeCloseTo(c.outcome.result.summary.todayAchievementPct!, 9);
  });

  it('화면 계산이 비재계산 모드에서 만든 값은 같은 날 재계산 없이 domain으로 다시 구한 값과 일치한다', () => {
    const c = plan(form({ todayRead: [row('GEN', '1', '1', '1', '6')] }));
    // 시작일이 오늘이면 asOf=오늘은 최초 계획과 같은 배정이므로 domain 값과 비교할 수 있다.
    const re = computePlan({ ...c.input, asOf: TODAY });
    expect(re.ok).toBe(true);
    const s = todayState(c.outcome.result, SAMPLE_BIBLE, TODAY, c.input.todayRead ?? []);
    expect(s.kind === 'entered' && s.pct).toBeCloseTo(re.ok ? re.result.summary.todayAchievementPct! : -1, 9);
  });
});

describe('baselineInput', () => {
  it('재계산·읽은 분량·오늘 읽은 범위를 뺀 최초 계획 입력', () => {
    const c = computeFromForm(form({ recalc: true, readMode: 'continuous', through: { bookId: 'GEN', chapter: '1', verse: '3' }, todayRead: [row('GEN', '1', '4', '1', '5')] }), SAMPLE_BIBLE, TODAY);
    if (!c.ok) throw new Error('fail');
    const b = baselineInput(c.input);
    expect(b.asOf).toBeUndefined();
    expect(b.todayRead).toBeUndefined();
    expect(b.read).toEqual({ mode: 'none' });
    expect(b.startDate).toBe(c.input.startDate);
  });
});
