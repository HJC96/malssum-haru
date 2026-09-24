import { samplePlan } from '@/app/test/plan';
import { buildExportModel } from './planExport';
import { A4_LANDSCAPE, A4_PORTRAIT, layoutPdf, layoutText, wrapText, type Measure, type PdfOp } from './pdfLayout';

/** 한글은 전각(1em), 그 외는 반각(0.5em)으로 계산하는 가짜 측정 함수. */
const measure: Measure = (text, size) =>
  Array.from(text).reduce((a, ch) => a + (/[ㄱ-힝]/.test(ch) ? size : size * 0.5), 0);

const norm = (s: string) => s.replace(/\s+/g, '');
const model = (over = {}, lang: 'ko' | 'en' = 'ko') =>
  buildExportModel(samplePlan(over), { lang, planName: '내 일독 계획', generatedOn: '2026-09-24' });

describe('wrapText', () => {
  it('폭을 넘으면 공백에서 줄을 바꾸고 글자를 버리지 않는다', () => {
    const lines = wrapText('창세기 1:1–3:24, 출애굽기 1:1–5:9', 100, 10, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(norm(lines.join(''))).toBe(norm('창세기 1:1–3:24, 출애굽기 1:1–5:9'));
    expect(lines.every((l) => measure(l, 10) <= 100)).toBe(true);
  });

  it('공백 없는 긴 단어는 글자 단위로 나눈다', () => {
    const word = '가'.repeat(40);
    const lines = wrapText(word, 50, 10, measure);
    expect(lines.join('')).toBe(word);
    expect(lines.every((l) => measure(l, 10) <= 50)).toBe(true);
  });

  it('빈 문자열은 줄이 없다', () => {
    expect(wrapText('', 100, 10, measure)).toEqual([]);
  });
});

describe('목록형 레이아웃 (EXP02)', () => {
  it('A4 세로이고 모든 날짜와 범위 텍스트가 들어 있다(자르지 않음)', () => {
    const m = model({ startDate: '2026-10-01', endDate: '2027-03-31' });
    const pages = layoutPdf(m, { kind: 'list', month: null, measure });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((p) => p.width === A4_PORTRAIT.width && p.height === A4_PORTRAIT.height)).toBe(true);
    const text = layoutText(pages);
    for (const r of m.rows) {
      expect(text).toContain(norm(r.date));
      expect(text).toContain(norm(r.displayText));
    }
  });

  it('모든 그리기 요소가 페이지 안에 있다', () => {
    const m = model({ endDate: '2027-03-31' });
    for (const p of layoutPdf(m, { kind: 'list', month: null, measure })) {
      for (const o of p.ops) {
        if (o.type === 'text') {
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.x + measure(o.text, o.size)).toBeLessThanOrEqual(p.width);
          expect(o.y).toBeGreaterThanOrEqual(0);
          expect(o.y).toBeLessThanOrEqual(p.height);
        }
      }
    }
  });

  it('배정된 날에는 빈 체크 칸(사각형)이 있고, 쉬는 날에는 없다', () => {
    const m = model({ weekdays: [1, 2, 3, 4, 5] });
    const pages = layoutPdf(m, { kind: 'list', month: null, measure });
    const boxes = pages.flatMap((p) => p.ops).filter((o): o is Extract<PdfOp, { type: 'rect' }> => o.type === 'rect');
    expect(boxes).toHaveLength(m.rows.filter((r) => r.status === 'assigned').length);
  });

  it('선택한 월만 내보낸다', () => {
    const m = model({ startDate: '2026-10-25', endDate: '2026-12-03' });
    const text = layoutText(layoutPdf(m, { kind: 'list', month: '2026-11', measure }));
    expect(text).toContain('2026-11-15');
    expect(text).not.toContain('2026-10-30');
    expect(text).not.toContain('2026-12-01');
  });

  it('페이지 번호와 확인용 안내가 모든 페이지에 있다', () => {
    const pages = layoutPdf(model({ endDate: '2027-03-31' }), { kind: 'list', month: null, measure });
    pages.forEach((p, i) => {
      const t = p.ops.filter((o) => o.type === 'text').map((o) => (o as { text: string }).text);
      expect(t).toContain(`${i + 1} / ${pages.length}`);
      expect(t.some((s) => s.includes('읽은 기록이 아닙니다'))).toBe(true);
    });
  });

  it('부분 장이 있으면 표시한다', () => {
    const m = model({ endDate: '2026-10-10', read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 2, verse: 1 } } });
    expect(layoutText(layoutPdf(m, { kind: 'list', month: null, measure }))).toContain('부분장:');
  });
});

describe('월간형 레이아웃 (EXP02)', () => {
  it('A4 가로, 달마다 새 페이지, 요일 머리글이 있다', () => {
    const m = model({ startDate: '2026-10-15', endDate: '2026-12-10' });
    const pages = layoutPdf(m, { kind: 'month', month: null, measure });
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.every((p) => p.width === A4_LANDSCAPE.width)).toBe(true);
    const first = pages[0]!.ops.filter((o) => o.type === 'text').map((o) => (o as { text: string }).text);
    expect(first).toContain('2026년 10월');
    expect(['일', '월', '화', '수', '목', '금', '토'].every((d) => first.includes(d))).toBe(true);
  });

  it('모든 배정 날짜의 범위 텍스트가 빠짐없이 들어 있다', () => {
    const m = model({ startDate: '2026-10-01', endDate: '2027-01-31' });
    const text = layoutText(layoutPdf(m, { kind: 'month', month: null, measure }));
    for (const r of m.rows) expect(text).toContain(norm(r.displayText));
  });

  it('주 시작 요일을 바꾸면 머리글 순서가 바뀐다', () => {
    const m = model();
    const pages = layoutPdf(m, { kind: 'month', month: null, measure, weekStart: 1 });
    const texts = pages[0]!.ops.filter((o) => o.type === 'text') as Array<{ text: string; x: number; y: number }>;
    const heads = ['월', '화', '수', '목', '금', '토', '일'].map((d) => texts.find((t) => t.text === d)!.x);
    expect([...heads].sort((a, b) => a - b)).toEqual(heads);
  });

  it('영어 화면에서는 영어 월 이름과 책 이름을 쓴다', () => {
    const m = model({}, 'en');
    const pages = layoutPdf(m, { kind: 'month', month: null, measure });
    const t = layoutText(pages);
    expect(t).toContain('October2026');
    expect(t).toContain('Genesis');
  });

  it('좁은 칸의 긴 범위도 자르지 않는다(줄바꿈 후 모든 글자가 남는다)', () => {
    const narrow: Measure = (text, size) => text.length * size; // 전부 전각으로 취급해 더 좁게
    const m = model({ startDate: '2026-10-01', endDate: '2026-10-31' });
    const text = layoutText(layoutPdf(m, { kind: 'month', month: null, measure: narrow }));
    for (const r of m.rows) expect(text).toContain(norm(r.displayText));
  });
});
