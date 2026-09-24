import type { BookId, VerseRange } from './types';

const EN_DASH = '–';

/** 예: "요한복음 3:1–4:54", 같은 장이면 "요한복음 3:1–16", 한 절이면 "요한복음 3:16". */
export function formatRange(r: VerseRange, bookName: (id: BookId) => string): string {
  const name = bookName(r.bookId);
  const { start, end } = r;
  const head = `${name} ${start.chapter}:${start.verse}`;
  if (start.chapter === end.chapter) {
    return start.verse === end.verse ? head : `${head}${EN_DASH}${end.verse}`;
  }
  return `${head}${EN_DASH}${end.chapter}:${end.verse}`;
}
