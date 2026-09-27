// @vitest-environment node
import ExcelJS from 'exceljs';
import { samplePlan } from '@/app/test/plan';
import { buildExportModel } from './planExport';
import { buildXlsx, XLSX_HEADER_ROW } from './xlsx';

async function read(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('시트가 없습니다.');
  return ws;
}

describe('buildXlsx (EXP01)', () => {
  it('실제 xlsx(zip) 파일이고 다시 읽힌다', async () => {
    const model = buildExportModel(samplePlan(), { lang: 'ko', planName: '내 성경 읽기', generatedOn: '2026-09-24' });
    const bytes = await buildXlsx(model);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]); // "PK"
    const ws = await read(bytes);
    expect(ws.name).toBe('성경 읽기 계획');
  });

  it('메타: 계획 이름, 기간, 언어, 장절 기준, 계산 기준, 생성일, 데이터 버전', async () => {
    const plan = samplePlan();
    const model = buildExportModel(plan, { lang: 'ko', planName: '내 성경 읽기', generatedOn: '2026-09-24' });
    const ws = await read(await buildXlsx(model));
    const meta = new Map<string, string>();
    for (let r = 1; r <= 8; r++) meta.set(String(ws.getCell(r, 1).value), String(ws.getCell(r, 2).value));
    expect(meta.get('계획 이름')).toBe('내 성경 읽기');
    expect(meta.get('기간')).toBe('2026-10-01 ~ 2026-10-31');
    expect(meta.get('언어')).toBe('한국어');
    expect(meta.get('장절 기준')).toBe(plan.versificationSystem);
    expect(meta.get('데이터 버전')).toBe('sample-0');
    expect(meta.get('계산 기준')).toContain('절 단위');
    expect(meta.get('재계산')).toBe('최초 계획');
    expect(meta.get('생성일')).toBe('2026-09-24');
  });

  it('행 데이터가 모델과 같다: 날짜(달력 날짜 그대로), 요일, 범위, 절 수, 장 수, 부분 장, 빈 체크 칸', async () => {
    const plan = samplePlan({ weekdays: [1, 2, 3, 4, 5], read: { mode: 'continuous', through: { bookId: 'GEN', chapter: 2, verse: 1 } }, endDate: '2026-10-20' });
    const model = buildExportModel(plan, { lang: 'ko', planName: '', generatedOn: '2026-09-24' });
    const ws = await read(await buildXlsx(model));
    model.rows.forEach((row, i) => {
      const r = XLSX_HEADER_ROW + 1 + i;
      const date = ws.getCell(r, 1).value as Date;
      expect(date.toISOString().slice(0, 10)).toBe(row.date);
      expect(ws.getCell(r, 2).value).toBe(row.weekdayLabel);
      expect(ws.getCell(r, 3).value).toBe(row.displayText);
      if (row.status === 'assigned') {
        expect(ws.getCell(r, 4).value).toBe(row.verseCount);
        expect(ws.getCell(r, 5).value).toBe(row.chapterCount);
        expect(ws.getCell(r, 6).value ?? '').toBe(row.partialText);
      } else {
        expect(ws.getCell(r, 4).value).toBeNull();
      }
      expect(ws.getCell(r, 7).value).toBeNull(); // 체크 칸은 비어 있다
    });
    expect(ws.rowCount).toBe(XLSX_HEADER_ROW + model.rows.length);
  });

  it('배정 절 수 합계가 남은 절 수와 같다', async () => {
    const plan = samplePlan();
    const model = buildExportModel(plan, { lang: 'ko', planName: '', generatedOn: '2026-09-24' });
    const ws = await read(await buildXlsx(model));
    let sum = 0;
    for (let r = XLSX_HEADER_ROW + 1; r <= ws.rowCount; r++) sum += Number(ws.getCell(r, 4).value ?? 0);
    expect(sum).toBe(plan.summary.remainingVerses);
  });

  it('한글·영어 텍스트와 줄바꿈 서식이 보존된다', async () => {
    const ko = buildExportModel(samplePlan(), { lang: 'ko', planName: '한글 이름 ✝ plan', generatedOn: '2026-09-24' });
    const en = buildExportModel(samplePlan(), { lang: 'en', planName: 'My plan', generatedOn: '2026-09-24' });
    const wsKo = await read(await buildXlsx(ko));
    const wsEn = await read(await buildXlsx(en));
    expect(wsKo.getCell(1, 2).value).toBe('한글 이름 ✝ plan');
    expect(String(wsKo.getCell(XLSX_HEADER_ROW + 1, 3).value)).toContain('창세기');
    expect(String(wsEn.getCell(XLSX_HEADER_ROW + 1, 3).value)).toContain('Genesis');
    expect(wsEn.getCell(XLSX_HEADER_ROW + 1, 3).alignment?.wrapText).toBe(true);
    expect(wsEn.name).toBe('Bible reading plan');
  });

  it('선택한 월의 행만 내보낼 수 있다', async () => {
    const plan = samplePlan({ startDate: '2026-10-25', endDate: '2026-11-05' });
    const model = buildExportModel(plan, { lang: 'ko', planName: '', generatedOn: '2026-09-24' });
    const nov = model.rows.filter((r) => r.date.startsWith('2026-11'));
    const ws = await read(await buildXlsx(model, nov));
    expect(ws.rowCount).toBe(XLSX_HEADER_ROW + nov.length);
    expect(ws.getCell(2, 2).value).toBe('2026-11-01 ~ 2026-11-05');
  });

  it('1년(365일) 계획도 빠르게 만든다', async () => {
    const plan = samplePlan({ startDate: '2026-10-01', endDate: '2027-09-30' });
    const model = buildExportModel(plan, { lang: 'ko', planName: '', generatedOn: '2026-09-24' });
    const t0 = performance.now();
    const bytes = await buildXlsx(model);
    expect(performance.now() - t0).toBeLessThan(10_000);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
