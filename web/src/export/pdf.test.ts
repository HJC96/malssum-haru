// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import { extractPdfText } from '@/app/test/pdfText';
import { samplePlan } from '@/app/test/plan';
import { buildPdf, PDF_FONT_PATH } from './pdf';
import { buildExportModel } from './planExport';

const fontBytes = new Uint8Array(readFileSync(resolve(process.cwd(), 'public', PDF_FONT_PATH)));
const norm = (s: string) => s.replace(/\s+/g, '');
const model = (over = {}, lang: 'ko' | 'en' = 'ko', planName = '내 성경 읽기 계획') =>
  buildExportModel(samplePlan(over), { lang, planName, generatedOn: '2026-09-24' });

describe('buildPdf (EXP02)', () => {
  it('실제 PDF이고 한글 폰트 프로그램이 통째로 임베드된다(그려지지 않는 글리프가 없도록)', async () => {
    const bytes = await buildPdf(model(), { kind: 'list', month: null, fontBytes });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe('내 성경 읽기 계획');
    // pdf-lib의 재서브셋은 일부 글리프를 잃으므로 쓰지 않는다: 폰트 파일이 원본 그대로 들어 있어야 한다.
    const ctx = doc.context;
    const sizes: number[] = [];
    for (const [, obj] of ctx.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict && obj.get(PDFName.of('FontFile2'))) {
        const ref = obj.get(PDFName.of('FontFile2')) as PDFRef;
        const stream = ctx.lookup(ref) as PDFRawStream;
        sizes.push(decodePDFRawStream(stream).decode().length);
      }
    }
    expect(sizes).toEqual([fontBytes.length]);
    // 압축되므로 PDF 파일 자체는 원본 폰트보다 작다.
    expect(bytes.length).toBeLessThan(fontBytes.length);
  });

  it('목록형: 페이지 크기는 A4 세로', async () => {
    const doc = await PDFDocument.load(await buildPdf(model(), { kind: 'list', month: null, fontBytes }));
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('월간형: 페이지 크기는 A4 가로', async () => {
    const doc = await PDFDocument.load(await buildPdf(model(), { kind: 'month', month: null, fontBytes }));
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  it('목록형 PDF에서 추출한 텍스트에 모든 날짜와 범위가 들어 있다 (한글이 깨지지 않는다)', async () => {
    const m = model({ startDate: '2026-10-01', endDate: '2027-03-31', weekdays: [1, 2, 3, 4, 5] });
    const pages = await extractPdfText(await buildPdf(m, { kind: 'list', month: null, fontBytes }));
    const text = norm(pages.flat().join(''));
    expect(text).not.toContain('\uFFFD');
    for (const r of m.rows) {
      expect(text).toContain(norm(r.date));
      expect(text).toContain(norm(r.displayText));
    }
    expect(text).toContain(norm('내 성경 읽기 계획'));
  });

  it('월간형 PDF도 모든 배정 범위를 포함한다', async () => {
    const m = model({ startDate: '2026-10-01', endDate: '2027-01-31' });
    const pages = await extractPdfText(await buildPdf(m, { kind: 'month', month: null, fontBytes }));
    const text = norm(pages.flat().join(''));
    for (const r of m.rows) expect(text).toContain(norm(r.displayText));
    expect(text).toContain('2026년10월');
  });

  it('영어 화면의 PDF는 영어 책 이름과 월 이름을 쓴다', async () => {
    const m = model({}, 'en', 'My plan');
    const pages = await extractPdfText(await buildPdf(m, { kind: 'month', month: null, fontBytes }));
    const text = norm(pages.flat().join(''));
    expect(text).toContain('Genesis');
    expect(text).toContain('October2026');
  });

  it('선택한 월만 내보낸다', async () => {
    const m = model({ startDate: '2026-10-25', endDate: '2026-12-03' });
    const pages = await extractPdfText(await buildPdf(m, { kind: 'list', month: '2026-11', fontBytes }));
    const text = norm(pages.flat().join(''));
    expect(text).toContain('2026-11-15');
    expect(text).not.toContain('2026-10-30');
  });

  it('폰트에 없는 글자는 ?로 바꿔 그리고 실패하지 않는다', async () => {
    const m = model({}, 'ko', '龍 plan \u{1F600}');
    const pages = await extractPdfText(await buildPdf(m, { kind: 'list', month: null, fontBytes }));
    const text = pages.flat().join('');
    expect(text).toContain('? plan ?');
  });

  it('1년(365일) 계획의 목록형·월간형 PDF를 30초 안에 만든다', async () => {
    const m = model({ startDate: '2026-10-01', endDate: '2027-09-30' });
    const t0 = performance.now();
    await buildPdf(m, { kind: 'list', month: null, fontBytes });
    await buildPdf(m, { kind: 'month', month: null, fontBytes });
    expect(performance.now() - t0).toBeLessThan(30_000);
  });
});
