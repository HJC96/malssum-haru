// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { BOOKS, MESSAGES } from '@/i18n';
import { PDF_FONT_PATH } from './pdf';

const bytes = readFileSync(resolve(process.cwd(), 'public', PDF_FONT_PATH));
const font = fontkit.create(bytes) as { hasGlyphForCodePoint(cp: number): boolean };

const missing = (texts: string[]) => {
  const out = new Set<string>();
  for (const text of texts) {
    for (const ch of Array.from(text)) {
      if (/\s/.test(ch) || ch === '–') continue; // 공백, en dash는 아래에서 따로 확인
      if (!font.hasGlyphForCodePoint(ch.codePointAt(0) as number)) out.add(ch);
    }
  }
  return [...out];
};

describe('PDF 폰트 글리프 커버리지 (Noto Sans KR 서브셋)', () => {
  it('66권 한글·영어 책 이름의 모든 글자가 있다', () => {
    expect(missing(BOOKS.flatMap((b) => [b.ko, b.en]))).toEqual([]);
  });

  it('내보내기(export.*) 문구의 모든 글자가 있다', () => {
    const keys = (Object.keys(MESSAGES.ko) as Array<keyof typeof MESSAGES.ko>).filter((k) => k.startsWith('export.'));
    expect(missing(keys.flatMap((k) => [MESSAGES.ko[k], MESSAGES.en[k]]))).toEqual([]);
  });

  it('UI 문구 전체(한국어·영어)의 글자가 있다', () => {
    expect(missing([...Object.values(MESSAGES.ko), ...Object.values(MESSAGES.en)])).toEqual([]);
  });

  it('검사 자체가 동작한다: 서브셋에 없는 글자는 없다고 나온다', () => {
    expect(missing(['龍', '\u{1F600}'])).toEqual(['龍', '\u{1F600}']);
  });

  it('범위 표기에 쓰는 기호가 있다: 숫자, 콜론, 쉼표, 세미콜론, 물음표, 괄호, 물결, 슬래시, en dash', () => {
    expect(missing(['0123456789:,;?()~/-.'])).toEqual([]);
    expect(font.hasGlyphForCodePoint(0x2013)).toBe(true);
  });
});
