import { translate, type MessageKey } from '@/i18n';
import type { Weekday } from '@/domain';
import type { ExportModel, ExportRow } from './planExport';
import { rowsForMonth } from './planExport';

/**
 * PDF 레이아웃(순수 함수). 글자 폭 측정은 주입하므로 폰트 없이 테스트할 수 있고,
 * 실제 그리기(pdf.ts)는 이 결과를 그대로 그린다. 긴 범위는 자르지 않고 줄바꿈하며,
 * 페이지가 모자라면 다음 페이지로 이어진다.
 */
export type PdfOp =
  | { type: 'text'; x: number; y: number; size: number; text: string; gray?: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number; fillGray?: number; stroke?: boolean }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number };

export interface PdfPageSpec {
  width: number;
  height: number;
  ops: PdfOp[];
}

export type Measure = (text: string, size: number) => number;

export type PdfKind = 'list' | 'month';

export interface PdfLayoutOptions {
  kind: PdfKind;
  /** 'YYYY-MM'이면 그 달만, null이면 계획 전체. */
  month: string | null;
  measure: Measure;
  /** 월간형의 주 시작 요일. 기본 일요일. */
  weekStart?: Weekday;
}

export const A4_PORTRAIT = { width: 595.28, height: 841.89 } as const;
export const A4_LANDSCAPE = { width: 841.89, height: 595.28 } as const;

const MARGIN = 36;
const FOOTER_H = 22;

/** 공백 단위로 줄바꿈하고, 한 단어가 칸보다 넓으면 글자 단위로 나눈다. 글자를 버리지 않는다. */
export function wrapText(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  if (text === '') return [];
  const lines: string[] = [];
  let line = '';
  const flush = () => {
    if (line !== '') lines.push(line);
    line = '';
  };
  for (const word of text.split(' ')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (measure(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    flush();
    if (measure(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    for (const ch of Array.from(word)) {
      if (line !== '' && measure(line + ch, size) > maxWidth) flush();
      line += ch;
    }
  }
  flush();
  return lines;
}

interface PageBuilder {
  pages: PdfPageSpec[];
  page: PdfPageSpec;
  /** 현재 y(위에서 아래로 줄어드는 pdf 좌표). */
  y: number;
}

function newPage(b: PageBuilder, size: { width: number; height: number }): void {
  b.page = { width: size.width, height: size.height, ops: [] };
  b.pages.push(b.page);
  b.y = size.height - MARGIN;
}

function addFooters(pages: PdfPageSpec[], model: ExportModel, measure: Measure): void {
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(model.meta.lang, key, p);
  pages.forEach((p, i) => {
    const label = t('export.pdf.page', { page: i + 1, total: pages.length });
    p.ops.push({ type: 'text', x: MARGIN, y: MARGIN - 18, size: 8, text: t('export.pdf.note'), gray: 0.4 });
    const w = measure(label, 8);
    p.ops.push({ type: 'text', x: p.width - MARGIN - w, y: MARGIN - 18, size: 8, text: label, gray: 0.4 });
  });
}

function metaLines(model: ExportModel, rows: ExportRow[], month: string | null): string[] {
  const { meta } = model;
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(meta.lang, key, p);
  const first = rows[0]?.date ?? meta.startDate;
  const last = rows[rows.length - 1]?.date ?? meta.endDate;
  void month;
  return [
    `${t('export.meta.period')}: ${first} ~ ${last}`,
    `${t('export.meta.basis')}: ${meta.basisLabel}`,
    `${t('export.meta.recalculated')}: ${meta.recalculatedLabel}`,
    `${t('export.meta.versification')}: ${meta.versificationSystem} / ${t('export.meta.dataVersion')}: ${meta.dataVersion}`,
    `${t('export.meta.language')}: ${meta.languageLabel} / ${t('export.meta.generatedOn')}: ${meta.generatedOn}`,
  ];
}

function layoutList(model: ExportModel, rows: ExportRow[], month: string | null, measure: Measure): PdfPageSpec[] {
  const size = A4_PORTRAIT;
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(model.meta.lang, key, p);
  const b: PageBuilder = { pages: [], page: { width: 0, height: 0, ops: [] }, y: 0 };
  newPage(b, size);

  // 제목과 메타
  b.page.ops.push({ type: 'text', x: MARGIN, y: b.y - 16, size: 16, text: model.meta.planName });
  b.y -= 24;
  b.page.ops.push({ type: 'text', x: MARGIN, y: b.y - 10, size: 10, text: t('export.title'), gray: 0.35 });
  b.y -= 18;
  for (const line of metaLines(model, rows, month)) {
    for (const wrapped of wrapText(line, size.width - 2 * MARGIN, 8.5, measure)) {
      b.page.ops.push({ type: 'text', x: MARGIN, y: b.y - 9, size: 8.5, text: wrapped, gray: 0.25 });
      b.y -= 11.5;
    }
  }
  b.y -= 8;

  const colCheck = MARGIN;
  const colDate = MARGIN + 24;
  const colRange = MARGIN + 24 + 104;
  const colVerses = size.width - MARGIN - 52;
  const rangeW = colVerses - colRange - 8;
  const bottom = MARGIN + FOOTER_H;

  const drawHeader = () => {
    const y = b.y - 12;
    b.page.ops.push({ type: 'text', x: colCheck, y, size: 9, text: t('export.col.check') });
    b.page.ops.push({ type: 'text', x: colDate, y, size: 9, text: `${t('export.col.date')} (${t('export.col.weekday')})` });
    b.page.ops.push({ type: 'text', x: colRange, y, size: 9, text: t('export.col.range') });
    b.page.ops.push({ type: 'text', x: colVerses, y, size: 9, text: t('export.col.verses') });
    b.page.ops.push({ type: 'line', x1: MARGIN, y1: b.y - 16, x2: size.width - MARGIN, y2: b.y - 16 });
    b.y -= 20;
  };
  drawHeader();

  for (const r of rows) {
    const assigned = r.status === 'assigned';
    const lines = wrapText(r.displayText, rangeW, 10, measure);
    const partial = assigned && r.partialText ? wrapText(`${t('export.col.partial')}: ${r.partialText}`, rangeW, 8, measure) : [];
    const h = Math.max(18, 6 + lines.length * 13 + partial.length * 10.5);
    if (b.y - h < bottom) {
      newPage(b, size);
      drawHeader();
    }
    const top = b.y;
    if (assigned) b.page.ops.push({ type: 'rect', x: colCheck, y: top - 14, w: 10, h: 10, stroke: true });
    b.page.ops.push({ type: 'text', x: colDate, y: top - 12, size: 10, text: `${r.date} (${r.weekdayLabel})`, ...(assigned ? {} : { gray: 0.5 }) });
    lines.forEach((l, i) => {
      b.page.ops.push({ type: 'text', x: colRange, y: top - 12 - i * 13, size: 10, text: l, ...(assigned ? {} : { gray: 0.5 }) });
    });
    partial.forEach((l, i) => {
      b.page.ops.push({ type: 'text', x: colRange, y: top - 12 - lines.length * 13 - i * 10.5 + 1, size: 8, text: l, gray: 0.4 });
    });
    if (assigned) b.page.ops.push({ type: 'text', x: colVerses, y: top - 12, size: 10, text: String(r.verseCount) });
    b.page.ops.push({ type: 'line', x1: MARGIN, y1: top - h, x2: size.width - MARGIN, y2: top - h });
    b.y -= h;
  }

  addFooters(b.pages, model, measure);
  return b.pages;
}

function daysInMonthOf(ym: string): number {
  const [y = 0, m = 1] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function weekdayOfIso(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function monthTitle(lang: 'ko' | 'en', ym: string): string {
  const [y = 0, m = 1] = ym.split('-').map(Number);
  const monthLabel = lang === 'ko' ? m : new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  return translate(lang, 'export.pdf.month', { year: y, month: monthLabel });
}

function layoutMonths(model: ExportModel, rows: ExportRow[], measure: Measure, weekStart: Weekday): PdfPageSpec[] {
  const size = A4_LANDSCAPE;
  const t = (key: MessageKey, p?: Record<string, string | number>) => translate(model.meta.lang, key, p);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const months: string[] = [];
  for (const r of rows) {
    const ym = r.date.slice(0, 7);
    if (months[months.length - 1] !== ym) months.push(ym);
  }

  const b: PageBuilder = { pages: [], page: { width: 0, height: 0, ops: [] }, y: 0 };
  const gridW = size.width - 2 * MARGIN;
  const colW = gridW / 7;
  const bottom = MARGIN + FOOTER_H;
  const fontSize = 7.5;
  const lineH = 9.5;

  for (const ym of months) {
    const drawMonthHeader = (continued: boolean) => {
      newPage(b, size);
      const title = continued ? `${monthTitle(model.meta.lang, ym)} (${model.meta.planName})` : monthTitle(model.meta.lang, ym);
      b.page.ops.push({ type: 'text', x: MARGIN, y: b.y - 16, size: 16, text: title });
      b.y -= 24;
      if (!continued) {
        b.page.ops.push({ type: 'text', x: MARGIN, y: b.y - 9, size: 8.5, text: `${model.meta.planName} / ${t('export.meta.basis')}: ${model.meta.basisLabel} / ${model.meta.recalculatedLabel}`, gray: 0.3 });
        b.y -= 14;
      }
      for (let c = 0; c < 7; c++) {
        const wd = ((weekStart + c) % 7) as Weekday;
        b.page.ops.push({ type: 'text', x: MARGIN + c * colW + 4, y: b.y - 11, size: 9, text: t(`export.weekday.${wd}` as MessageKey) });
      }
      b.page.ops.push({ type: 'line', x1: MARGIN, y1: b.y - 15, x2: MARGIN + gridW, y2: b.y - 15 });
      b.y -= 16;
    };

    drawMonthHeader(false);
    const total = daysInMonthOf(ym);
    const lead = (weekdayOfIso(`${ym}-01`) - weekStart + 7) % 7;
    const cells: Array<number | null> = [...Array<null>(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    for (let w = 0; w < cells.length; w += 7) {
      const week = cells.slice(w, w + 7);
      const laid = week.map((day) => {
        const row = day === null ? undefined : byDate.get(`${ym}-${String(day).padStart(2, '0')}`);
        const text = row?.displayText ?? '';
        const lines = wrapText(text, colW - 8, fontSize, measure);
        return { day, row, lines };
      });
      const h = Math.max(54, 18 + Math.max(...laid.map((c) => c.lines.length)) * lineH + 6);
      if (b.y - h < bottom) drawMonthHeader(true);
      const top = b.y;
      laid.forEach((c, i) => {
        const x = MARGIN + i * colW;
        b.page.ops.push({ type: 'rect', x, y: top - h, w: colW, h, stroke: true, ...(c.row ? {} : { fillGray: 0.96 }) });
        if (c.day === null) return;
        b.page.ops.push({ type: 'text', x: x + 4, y: top - 12, size: 9, text: String(c.day), ...(c.row ? {} : { gray: 0.6 }) });
        if (c.row?.status === 'assigned') b.page.ops.push({ type: 'rect', x: x + colW - 14, y: top - 13, w: 8, h: 8, stroke: true });
        c.lines.forEach((l, li) => {
          b.page.ops.push({ type: 'text', x: x + 4, y: top - 22 - li * lineH, size: fontSize, text: l, ...(c.row?.status === 'assigned' ? {} : { gray: 0.5 }) });
        });
      });
      b.y -= h;
    }
  }

  addFooters(b.pages, model, measure);
  return b.pages;
}

export function layoutPdf(model: ExportModel, opts: PdfLayoutOptions): PdfPageSpec[] {
  const rows = rowsForMonth(model, opts.month);
  return opts.kind === 'list'
    ? layoutList(model, rows, opts.month, opts.measure)
    : layoutMonths(model, rows, opts.measure, opts.weekStart ?? 0);
}

/** 레이아웃에 실린 모든 텍스트(공백 제거). 데이터 일치 검증용. */
export function layoutText(pages: PdfPageSpec[]): string {
  return pages
    .flatMap((p) => p.ops)
    .filter((o): o is Extract<PdfOp, { type: 'text' }> => o.type === 'text')
    .map((o) => o.text)
    .join('')
    .replace(/\s+/g, '');
}
