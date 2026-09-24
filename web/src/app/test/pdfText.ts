import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, type PDFObject } from 'pdf-lib';

/**
 * 테스트 전용: pdf-lib로 만든 PDF의 페이지별 텍스트를 콘텐츠 스트림과 ToUnicode CMap으로 복원한다.
 * (Identity-H로 임베드된 글리프 ID를 유니코드로 되돌린다.)
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string[][]> {
  const doc = await PDFDocument.load(bytes);
  const ctx = doc.context;
  const deref = (o: PDFObject | undefined): PDFObject | undefined => (o instanceof PDFRef ? ctx.lookup(o) : o);

  const streamText = (o: PDFObject | undefined): string => {
    const s = deref(o);
    if (!(s instanceof PDFRawStream)) return '';
    return Buffer.from(decodePDFRawStream(s).decode()).toString('latin1');
  };

  // 모든 ToUnicode CMap에서 gid -> 문자 표를 모은다(서브셋 폰트 1개를 쓰므로 충돌하지 않는다).
  const map = new Map<string, string>();
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const tu = deref(obj.get(PDFName.of('ToUnicode')));
    if (!tu) continue;
    const cmap = streamText(tu);
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const m of (block[1] ?? '').matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        map.set((m[1] as string).toUpperCase().padStart(4, '0'), hexToText(m[2] as string));
      }
    }
    for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const m of (block[1] ?? '').matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        const from = parseInt(m[1] as string, 16);
        const to = parseInt(m[2] as string, 16);
        const base = parseInt(m[3] as string, 16);
        for (let g = from; g <= to; g++) map.set(g.toString(16).toUpperCase().padStart(4, '0'), String.fromCodePoint(base + g - from));
      }
    }
  }

  return doc.getPages().map((page) => {
    const contents = deref(page.node.get(PDFName.of('Contents')));
    const parts = contents instanceof PDFArray ? contents.asArray().map(streamText) : [streamText(contents)];
    const text = parts.join('\n');
    const out: string[] = [];
    for (const m of text.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g)) {
      const hex = (m[1] as string).toUpperCase();
      let s = '';
      for (let i = 0; i < hex.length; i += 4) s += map.get(hex.slice(i, i + 4)) ?? '\uFFFD';
      out.push(s);
    }
    return out;
  });
}

function hexToText(hex: string): string {
  let s = '';
  for (let i = 0; i < hex.length; i += 4) s += String.fromCodePoint(parseInt(hex.slice(i, i + 4), 16));
  return s;
}
