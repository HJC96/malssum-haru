import { translate, type MessageKey } from '@/i18n';
import type { ExportModel, ExportRow } from './planExport';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function toUtcDate(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 헤더 행의 위치(1부터). 메타 정보 뒤에 온다. */
export const XLSX_META_ROWS = 8;
export const XLSX_HEADER_ROW = XLSX_META_ROWS + 2;

/**
 * 계획 모델을 실제 .xlsx로 만든다. exceljs는 이 함수를 부를 때만 내려받는다(지연 로드).
 * 날짜 셀은 UTC 자정의 실제 날짜 값에 yyyy-mm-dd 서식을 주므로 시간대에 따라 하루가 밀리지 않는다.
 * 체크 칸은 비워 둔다. 읽은 기록을 채우거나 다시 불러오는 용도가 아니다.
 */
export async function buildXlsx(model: ExportModel, rows: ExportRow[] = model.rows): Promise<Uint8Array> {
  const { default: ExcelJS } = await import('exceljs');
  const { meta } = model;
  const t = (key: MessageKey, params?: Record<string, string | number>) => translate(meta.lang, key, params);

  const wb = new ExcelJS.Workbook();
  wb.creator = t('export.title');
  const ws = wb.addWorksheet(t('export.sheetName'), {
    views: [{ state: 'frozen', ySplit: XLSX_HEADER_ROW }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = model.chapterOnly ? [
    { width: 13 }, { width: 8 }, { width: 46 }, { width: 12 }, { width: 9 },
  ] : [
    { width: 13 },
    { width: 8 },
    { width: 46 },
    { width: 12 },
    { width: 9 },
    { width: 26 },
    { width: 9 },
  ];

  const first = rows[0]?.date ?? meta.startDate;
  const last = rows[rows.length - 1]?.date ?? meta.endDate;
  const metaLines: Array<[MessageKey, string]> = [
    ['export.meta.planName', meta.planName],
    ['export.meta.period', `${first} ~ ${last}`],
    ['export.meta.language', meta.languageLabel],
    ['export.meta.versification', meta.versificationSystem],
    ['export.meta.dataVersion', meta.dataVersion],
    ['export.meta.basis', meta.basisLabel],
    ['export.meta.recalculated', meta.recalculatedLabel],
    ['export.meta.generatedOn', meta.generatedOn],
  ];
  metaLines.forEach(([key, value], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = t(key);
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(i + 1, 2, i + 1, model.chapterOnly ? 5 : 7);
  });

  const header = ws.getRow(XLSX_HEADER_ROW);
  const headers = model.chapterOnly
    ? ['export.col.date', 'export.col.weekday', 'export.col.range', 'export.col.chapters', 'export.col.check'] as const
    : ['export.col.date', 'export.col.weekday', 'export.col.range', 'export.col.verses', 'export.col.chapters', 'export.col.partial', 'export.col.check'] as const;
  headers.forEach((key, i) => {
    const cell = header.getCell(i + 1);
    cell.value = t(key);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E5DC' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin' } };
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(XLSX_HEADER_ROW + 1 + i);
    const assigned = r.status === 'assigned';
    row.getCell(1).value = toUtcDate(r.date);
    row.getCell(1).numFmt = 'yyyy-mm-dd';
    row.getCell(2).value = r.weekdayLabel;
    row.getCell(3).value = r.displayText;
    if (assigned) {
      row.getCell(4).value = model.chapterOnly ? r.chapterCount : r.verseCount;
      if (!model.chapterOnly) {
        row.getCell(5).value = r.chapterCount;
        if (r.partialText) row.getCell(6).value = r.partialText;
      }
    }
    const checkColumn = model.chapterOnly ? 5 : 7;
    row.getCell(checkColumn).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    for (let c = 1; c <= checkColumn; c++) {
      row.getCell(c).alignment = { vertical: 'top', wrapText: true, horizontal: c === 3 || (!model.chapterOnly && c === 6) ? 'left' : 'center' };
    }
    if (!assigned) row.getCell(3).font = { italic: true, color: { argb: 'FF666666' } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function xlsxBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: XLSX_MIME });
}
