import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import { extractPdfText } from '@/app/test/pdfText';
import { renderPlan, setDate } from '@/app/test/planUi';
import { XLSX_HEADER_ROW } from '@/export/xlsx';
import { PDF_FONT_PATH, resetPdfFontCache } from '@/export/pdf';

const downloads: Array<{ blob: Blob; name: string }> = [];
vi.mock('@/export/download', () => ({
  downloadBlob: (blob: Blob, name: string) => {
    downloads.push({ blob, name });
  },
}));

const fontBytes = readFileSync(resolve(process.cwd(), 'public', PDF_FONT_PATH));
const norm = (s: string) => s.replace(/\s+/g, '');

/** 화면 목록의 날짜별 표시 텍스트(부분 장 주석 제외). */
function screenRows(): Array<{ date: string; text: string; verses: string }> {
  return [...document.querySelectorAll('tr.day-row')].map((tr) => ({
    date: tr.getAttribute('data-date') as string,
    text: tr.querySelector('.day-row__range')?.firstChild?.textContent?.trim() ?? '',
    verses: tr.querySelector('.day-row__num')?.textContent?.replace(/\D+/g, '') ?? '',
  }));
}

async function lastDownload() {
  await waitFor(() => expect(downloads.length).toBeGreaterThan(0), { timeout: 20_000 });
  return downloads[downloads.length - 1]!;
}

beforeEach(() => {
  downloads.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).endsWith(PDF_FONT_PATH)) return new Response(new Uint8Array(fontBytes), { status: 200 });
      return new Response('not found', { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetPdfFontCache();
});

const planWithPartials = {
  startDate: '2026-09-24',
  endDate: '2026-10-23',
  weekdays: [1, 2, 3, 4, 5] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>,
  readMode: 'continuous' as const,
  through: { bookId: 'GEN', chapter: '2', verse: '1' },
};

describe('화면·Excel·PDF는 같은 계획을 보여 준다 (AC17, AC10)', () => {
  it('Excel의 날짜별 범위·절 수가 화면 목록과 같다', async () => {
    renderPlan({ initialForm: planWithPartials });
    const rows = screenRows();
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    const { blob, name } = await lastDownload();
    expect(name).toMatch(/^일독 계획-2026-09-24_2026-10-23\.xlsx$/);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0]!;
    expect(ws.rowCount).toBe(XLSX_HEADER_ROW + rows.length);
    rows.forEach((r, i) => {
      const row = XLSX_HEADER_ROW + 1 + i;
      expect((ws.getCell(row, 1).value as Date).toISOString().slice(0, 10)).toBe(r.date);
      expect(ws.getCell(row, 3).value).toBe(r.text);
      expect(String(ws.getCell(row, 4).value ?? '')).toBe(r.verses);
    });
  });

  it('PDF 목록형·월간형에서 추출한 텍스트에 화면의 모든 날짜별 범위가 있다', async () => {
    renderPlan({ initialForm: planWithPartials });
    const rows = screenRows();
    for (const [button, kind] of [[/PDF \(목록형\)|PDF 목록형/, 'list'], [/PDF 월간형/, 'month']] as const) {
      downloads.length = 0;
      await userEvent.click(screen.getByRole('button', { name: button }));
      const { blob, name } = await lastDownload();
      expect(name.endsWith(kind === 'list' ? '-list.pdf' : '-month.pdf')).toBe(true);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const text = norm((await extractPdfText(bytes)).flat().join(''));
      for (const r of rows) {
        expect(text).toContain(norm(r.text));
        if (kind === 'list') expect(text).toContain(r.date);
      }
    }
  });

  it('화면 · Excel · PDF가 한 모델에서 나온다: 언어를 영어로 하면 세 산출물이 모두 영어 책 이름이다', async () => {
    renderPlan({ lang: 'en', initialForm: planWithPartials });
    const rows = screenRows();
    expect(rows.some((r) => r.text.includes('Genesis'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await lastDownload()).blob.arrayBuffer());
    expect(wb.worksheets[0]!.getCell(XLSX_HEADER_ROW + 1, 3).value).toBe(rows[0]!.text);
    downloads.length = 0;
    await userEvent.click(screen.getByRole('button', { name: /PDF \(list\)/ }));
    const pdf = new Uint8Array(await (await lastDownload()).blob.arrayBuffer());
    expect(norm((await extractPdfText(pdf)).flat().join(''))).toContain(norm(rows[0]!.text));
  });

  it('선택한 월만 내보내면 그 달의 행만 들어간다', async () => {
    renderPlan({ initialForm: { ...planWithPartials, endDate: '2026-11-15' } });
    await userEvent.selectOptions(screen.getByLabelText('내보낼 범위'), '2026-11');
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    const { blob, name } = await lastDownload();
    expect(name).toMatch(/-2026-11\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0]!;
    expect(ws.rowCount).toBe(XLSX_HEADER_ROW + 15);
    expect((ws.getCell(XLSX_HEADER_ROW + 1, 1).value as Date).toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('조건을 바꾸면 새 파일이 새 계획을 따른다(재계획 후 파일 재생성)', async () => {
    renderPlan({ initialForm: planWithPartials });
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    const first = await lastDownload();
    downloads.length = 0;
    setDate('마감일', '2026-10-02');
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    const second = await lastDownload();
    expect(second.name).not.toBe(first.name);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await second.blob.arrayBuffer());
    expect(wb.worksheets[0]!.rowCount).toBe(XLSX_HEADER_ROW + 9); // 09-24 ~ 10-02
  });
});

describe('폰트 지연 로드', () => {
  it('PDF를 만들 때 처음 한 번만 요청하고, Excel·화면 조작에서는 요청하지 않는다', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(fontBytes), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderPlan({ initialForm: planWithPartials });
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    await lastDownload();
    expect(fetchMock).not.toHaveBeenCalled();
    downloads.length = 0;
    await userEvent.click(screen.getByRole('button', { name: /PDF 목록형/ }));
    await lastDownload();
    downloads.length = 0;
    await userEvent.click(screen.getByRole('button', { name: /PDF 월간형/ }));
    await lastDownload();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/fonts\/NotoSansKR-Regular-subset\.ttf$/);
    expect(init.credentials).toBe('omit');
  });
});

describe('내보내기 상태와 실패 격리', () => {
  it('완료를 알리고, 실패해도 계산 화면은 계속 동작한다 (OPS01)', async () => {
    renderPlan({ initialForm: planWithPartials });
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    await waitFor(() => expect(screen.getByText(/파일을 만들었습니다/)).toBeInTheDocument());

    resetPdfFontCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    await userEvent.click(screen.getByRole('button', { name: /PDF 월간형/ }));
    await waitFor(() => expect(screen.getByText(/파일을 만들지 못했습니다/)).toBeInTheDocument());
    // 폰트를 못 받아도 계산과 다른 내보내기는 그대로다
    setDate('마감일', '2026-10-30');
    expect(screen.getByRole('region', { name: '계획 결과' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    await waitFor(() => expect(screen.getByText(/파일을 만들었습니다/)).toBeInTheDocument());
  });

  it('폰트 경로가 HTML(SPA 폴백 200)을 돌려주면 PDF를 만들지 못했다고 안내한다(F-02)', async () => {
    resetPdfFontCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    renderPlan({ initialForm: planWithPartials });
    await userEvent.click(screen.getByRole('button', { name: /PDF 목록형/ }));
    await waitFor(() => expect(screen.getByText(/파일을 만들지 못했습니다/)).toBeInTheDocument());
    // 내용 유형이 없어도 시그니처가 폰트가 아니면 거부한다
    resetPdfFontCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>' + ' '.repeat(20_000), { status: 200 })));
    await userEvent.click(screen.getByRole('button', { name: /PDF 월간형/ }));
    await waitFor(() => expect(screen.getAllByText(/파일을 만들지 못했습니다/).length).toBe(1));
    expect(downloads).toHaveLength(0);
  });

  it('인쇄 버튼은 브라우저 인쇄를 부르고, 인쇄용 표는 화면 목록과 같은 데이터다', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPlan({ initialForm: planWithPartials });
    await userEvent.click(screen.getByRole('button', { name: '인쇄' }));
    expect(print).toHaveBeenCalledTimes(1);
    const sheetRows = [...document.querySelectorAll('.print-sheet tbody tr')].map((tr) => (tr.children[1]?.textContent ?? '').slice(0, 10));
    expect(sheetRows).toEqual(screenRows().map((r) => r.date));
    print.mockRestore();
  });

  it('내려받은 파일 이름과 내용에 입력한 계획 이름이 들어간다', async () => {
    renderPlan({ initialForm: { ...planWithPartials, planName: '2027 일독' } });
    await userEvent.click(screen.getByRole('button', { name: /Excel/ }));
    const { name, blob } = await lastDownload();
    expect(name.startsWith('2027 일독-')).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets[0]!.getCell(1, 2).value).toBe('2027 일독');
  });
});
