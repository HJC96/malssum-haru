import type { Weekday } from '@/domain';
import type { ExportModel } from './planExport';
import { layoutPdf, type PdfKind, type PdfOp } from './pdfLayout';

/** 한글 서브셋 폰트(Noto Sans KR Regular, OFL). 내보내기 시점에만 요청한다. */
export const PDF_FONT_PATH = 'fonts/NotoSansKR-Regular-subset.ttf';

export interface BuildPdfOptions {
  kind: PdfKind;
  /** 'YYYY-MM'이면 그 달만, null이면 계획 전체. */
  month: string | null;
  weekStart?: Weekday;
  /** 테스트에서 폰트를 직접 넣는다. 없으면 PDF_FONT_PATH에서 내려받는다. */
  fontBytes?: Uint8Array;
}

let fontCache: Promise<Uint8Array> | null = null;

/** TrueType(0x00010000)·OpenType(OTTO)·'true' 시그니처와 최소 크기를 확인한다. */
export function assertFontBytes(bytes: Uint8Array): void {
  const tag = String.fromCharCode(...bytes.slice(0, 4));
  const ok = tag === '\u0000\u0001\u0000\u0000' || tag === 'OTTO' || tag === 'true';
  if (!ok || bytes.length < 10_000) throw new Error('PDF 폰트 파일이 올바르지 않습니다.');
}

/** 테스트에서 폰트 캐시를 비운다. */
export function resetPdfFontCache(): void {
  fontCache = null;
}

async function loadFontBytes(): Promise<Uint8Array> {
  fontCache ??= fetch(`${import.meta.env.BASE_URL}${PDF_FONT_PATH}`, { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then((res) => {
      if (!res.ok) throw new Error(`PDF 폰트를 불러오지 못했습니다: HTTP ${res.status}`);
      // 정적 호스트가 없는 경로에 index.html(200)을 돌려주는 경우를 걸러낸다(F-02).
      if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('PDF 폰트 대신 HTML이 왔습니다.');
      return res.arrayBuffer();
    })
    .then((buf) => {
      const bytes = new Uint8Array(buf);
      assertFontBytes(bytes);
      return bytes;
    });
  try {
    return await fontCache;
  } catch (e) {
    fontCache = null; // 다음 시도에서 다시 받는다.
    throw e;
  }
}

/**
 * 계획 모델을 PDF로 만든다. pdf-lib와 폰트는 이 함수를 부를 때만 내려받는다(지연 로드).
 * 폰트에 없는 글자는 '?'로 바꿔 그린다(PDF 생성이 실패하지 않게).
 */
export async function buildPdf(model: ExportModel, options: BuildPdfOptions): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, fontkitModule, fontBytes] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
    options.fontBytes ?? loadFontBytes(),
  ]);
  const fontkit = (fontkitModule as { default?: unknown }).default ?? fontkitModule;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit as Parameters<typeof doc.registerFontkit>[0]);
  const font = await doc.embedFont(fontBytes, { subset: false, features: { liga: false, clig: false, dlig: false } });
  const supported = new Set(font.getCharacterSet());
  const clean = (text: string) =>
    Array.from(text)
      .map((ch) => (supported.has(ch.codePointAt(0) as number) ? ch : '?'))
      .join('');

  const pages = layoutPdf(model, {
    kind: options.kind,
    month: options.month,
    measure: (text, size) => font.widthOfTextAtSize(clean(text), size),
    ...(options.weekStart === undefined ? {} : { weekStart: options.weekStart }),
  });

  doc.setTitle(model.meta.planName);
  doc.setCreator('말씀하루');
  doc.setProducer('말씀하루');

  for (const spec of pages) {
    const page = doc.addPage([spec.width, spec.height]);
    for (const op of spec.ops as PdfOp[]) {
      if (op.type === 'text') {
        const g = op.gray ?? 0;
        page.drawText(clean(op.text), { x: op.x, y: op.y, size: op.size, font, color: rgb(g, g, g) });
      } else if (op.type === 'rect') {
        page.drawRectangle({
          x: op.x,
          y: op.y,
          width: op.w,
          height: op.h,
          borderWidth: op.stroke ? 0.5 : 0,
          borderColor: rgb(0.35, 0.35, 0.35),
          ...(op.fillGray === undefined ? {} : { color: rgb(op.fillGray, op.fillGray, op.fillGray) }),
        });
      } else {
        page.drawLine({ start: { x: op.x1, y: op.y1 }, end: { x: op.x2, y: op.y2 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      }
    }
  }
  return doc.save();
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
