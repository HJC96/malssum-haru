import { samplePlan } from '@/app/test/plan';
import { buildExportModel, exportFileName, monthsOf, rowsForMonth, safeFileStem } from './planExport';

const opts = { lang: 'ko' as const, planName: '', generatedOn: '2026-09-24' };

describe('buildExportModel', () => {
  it('모든 날짜가 행이 되고, PlanResult 순서를 그대로 따른다', () => {
    const plan = samplePlan();
    const model = buildExportModel(plan, opts);
    expect(model.rows.map((r) => r.date)).toEqual(plan.days.map((d) => d.date));
    expect(model.meta.startDate).toBe('2026-10-01');
    expect(model.meta.endDate).toBe('2026-10-31');
    expect(model.meta.dataVersion).toBe('sample-0');
    expect(model.meta.generatedOn).toBe('2026-09-24');
  });

  it('배정 절 수 합계는 남은 절 수와 같다(누락·중복 없음)', () => {
    const plan = samplePlan();
    const model = buildExportModel(plan, opts);
    expect(model.rows.reduce((a, r) => a + r.verseCount, 0)).toBe(plan.summary.remainingVerses);
  });

  it('쉬는 날·빈 날·경과일은 범위 대신 상태 문구이며 완료/미완료 표현을 쓰지 않는다', () => {
    const plan = samplePlan({ weekdays: [1, 2, 3, 4, 5], asOf: '2026-10-10' });
    const model = buildExportModel(plan, opts);
    const off = model.rows.find((r) => r.status === 'off');
    const elapsed = model.rows.find((r) => r.status === 'elapsed');
    expect(off?.displayText).toBe('쉬는 날');
    expect(elapsed?.displayText).toBe('재계산 이전 날짜');
    for (const r of model.rows.filter((x) => x.status !== 'assigned')) {
      expect(r.rangeText).toBe('');
      expect(r.verseCount).toBe(0);
      expect(r.displayText).not.toMatch(/완료|미완료|읽음|못 읽/);
    }
  });

  it('배정이 없는 읽기 날짜(empty)를 빈 날로 표시한다', () => {
    const plan = samplePlan({ target: { kind: 'books', bookIds: ['OBA'] }, distribution: 'chapters' });
    const model = buildExportModel(plan, opts);
    expect(model.rows.some((r) => r.status === 'empty' && r.displayText === '배정 없음')).toBe(true);
  });

  it('부분 장을 식별할 수 있게 표시한다', () => {
    const plan = samplePlan({ endDate: '2026-10-10', distribution: 'verses', read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 2, verse: 1 } } });
    const model = buildExportModel(plan, opts);
    const rowsWithPartial = model.rows.filter((r) => r.partialText !== '');
    expect(rowsWithPartial.length).toBeGreaterThan(0);
    expect(rowsWithPartial[0]?.partialText).toMatch(/창세기 \d+장/);
  });

  it('언어를 바꾸면 이름과 문구만 바뀌고 날짜별 절 수는 같다(AC18)', () => {
    const plan = samplePlan();
    const ko = buildExportModel(plan, opts);
    const en = buildExportModel(plan, { ...opts, lang: 'en', planName: 'My plan' });
    expect(en.rows.map((r) => [r.date, r.verseCount, r.chapterCount])).toEqual(
      ko.rows.map((r) => [r.date, r.verseCount, r.chapterCount]),
    );
    expect(ko.rows[0]?.rangeText).toContain('창세기');
    expect(en.rows[0]?.rangeText).toContain('Genesis');
    expect(en.meta.planName).toBe('My plan');
    expect(en.rows[0]?.weekdayLabel).toBe('Thu');
  });

  it('재계산 여부를 최초 계획과 구분해 표시한다', () => {
    const first = buildExportModel(samplePlan(), opts).meta.recalculatedLabel;
    const re = buildExportModel(samplePlan({ asOf: '2026-10-10' }), opts).meta.recalculatedLabel;
    expect(first).toBe('최초 계획');
    expect(re).toContain('2026-10-10');
  });
});

describe('월 선택과 파일 이름', () => {
  it('계획 기간에 걸친 달 목록과 그 달의 행', () => {
    const model = buildExportModel(samplePlan({ startDate: '2026-10-25', endDate: '2026-12-03' }), opts);
    expect(monthsOf(model)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(rowsForMonth(model, '2026-11')).toHaveLength(30);
    expect(rowsForMonth(model, null)).toHaveLength(model.rows.length);
  });

  it('파일 이름에서 위험한 문자를 바꾼다', () => {
    expect(safeFileStem('a/b\\c:d*e?"f<g>h|i')).toBe('a_b_c_d_e__f_g_h_i');
    expect(safeFileStem('   ')).toBe('plan');
    const model = buildExportModel(samplePlan(), { ...opts, planName: '내 일독/계획' });
    expect(exportFileName(model, 'xlsx', null)).toBe('내 일독_계획-2026-10-01_2026-10-31.xlsx');
    expect(exportFileName(model, 'pdf', '2026-10', '-month')).toBe('내 일독_계획-2026-10-month.pdf');
  });
});
