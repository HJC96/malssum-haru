import type { Lang } from './lang';

/**
 * 성경 66권 표. 식별자는 언어와 무관한 USFM 3글자 대문자 bookId이고, 이름은 표시 전용이다.
 * 순서는 개신교 정경 순서(1..66)다. domain은 이름을 갖지 않으며 이 표만 이름의 출처다.
 */
export const BOOKS = [
  // 구약 39권
  { bookId: 'GEN', testament: 'OT', ko: '창세기', en: 'Genesis' },
  { bookId: 'EXO', testament: 'OT', ko: '출애굽기', en: 'Exodus' },
  { bookId: 'LEV', testament: 'OT', ko: '레위기', en: 'Leviticus' },
  { bookId: 'NUM', testament: 'OT', ko: '민수기', en: 'Numbers' },
  { bookId: 'DEU', testament: 'OT', ko: '신명기', en: 'Deuteronomy' },
  { bookId: 'JOS', testament: 'OT', ko: '여호수아', en: 'Joshua' },
  { bookId: 'JDG', testament: 'OT', ko: '사사기', en: 'Judges' },
  { bookId: 'RUT', testament: 'OT', ko: '룻기', en: 'Ruth' },
  { bookId: '1SA', testament: 'OT', ko: '사무엘상', en: '1 Samuel' },
  { bookId: '2SA', testament: 'OT', ko: '사무엘하', en: '2 Samuel' },
  { bookId: '1KI', testament: 'OT', ko: '열왕기상', en: '1 Kings' },
  { bookId: '2KI', testament: 'OT', ko: '열왕기하', en: '2 Kings' },
  { bookId: '1CH', testament: 'OT', ko: '역대상', en: '1 Chronicles' },
  { bookId: '2CH', testament: 'OT', ko: '역대하', en: '2 Chronicles' },
  { bookId: 'EZR', testament: 'OT', ko: '에스라', en: 'Ezra' },
  { bookId: 'NEH', testament: 'OT', ko: '느헤미야', en: 'Nehemiah' },
  { bookId: 'EST', testament: 'OT', ko: '에스더', en: 'Esther' },
  { bookId: 'JOB', testament: 'OT', ko: '욥기', en: 'Job' },
  { bookId: 'PSA', testament: 'OT', ko: '시편', en: 'Psalms' },
  { bookId: 'PRO', testament: 'OT', ko: '잠언', en: 'Proverbs' },
  { bookId: 'ECC', testament: 'OT', ko: '전도서', en: 'Ecclesiastes' },
  { bookId: 'SNG', testament: 'OT', ko: '아가', en: 'Song of Solomon' },
  { bookId: 'ISA', testament: 'OT', ko: '이사야', en: 'Isaiah' },
  { bookId: 'JER', testament: 'OT', ko: '예레미야', en: 'Jeremiah' },
  { bookId: 'LAM', testament: 'OT', ko: '예레미야애가', en: 'Lamentations' },
  { bookId: 'EZK', testament: 'OT', ko: '에스겔', en: 'Ezekiel' },
  { bookId: 'DAN', testament: 'OT', ko: '다니엘', en: 'Daniel' },
  { bookId: 'HOS', testament: 'OT', ko: '호세아', en: 'Hosea' },
  { bookId: 'JOL', testament: 'OT', ko: '요엘', en: 'Joel' },
  { bookId: 'AMO', testament: 'OT', ko: '아모스', en: 'Amos' },
  { bookId: 'OBA', testament: 'OT', ko: '오바댜', en: 'Obadiah' },
  { bookId: 'JON', testament: 'OT', ko: '요나', en: 'Jonah' },
  { bookId: 'MIC', testament: 'OT', ko: '미가', en: 'Micah' },
  { bookId: 'NAM', testament: 'OT', ko: '나훔', en: 'Nahum' },
  { bookId: 'HAB', testament: 'OT', ko: '하박국', en: 'Habakkuk' },
  { bookId: 'ZEP', testament: 'OT', ko: '스바냐', en: 'Zephaniah' },
  { bookId: 'HAG', testament: 'OT', ko: '학개', en: 'Haggai' },
  { bookId: 'ZEC', testament: 'OT', ko: '스가랴', en: 'Zechariah' },
  { bookId: 'MAL', testament: 'OT', ko: '말라기', en: 'Malachi' },
  // 신약 27권
  { bookId: 'MAT', testament: 'NT', ko: '마태복음', en: 'Matthew' },
  { bookId: 'MRK', testament: 'NT', ko: '마가복음', en: 'Mark' },
  { bookId: 'LUK', testament: 'NT', ko: '누가복음', en: 'Luke' },
  { bookId: 'JHN', testament: 'NT', ko: '요한복음', en: 'John' },
  { bookId: 'ACT', testament: 'NT', ko: '사도행전', en: 'Acts' },
  { bookId: 'ROM', testament: 'NT', ko: '로마서', en: 'Romans' },
  { bookId: '1CO', testament: 'NT', ko: '고린도전서', en: '1 Corinthians' },
  { bookId: '2CO', testament: 'NT', ko: '고린도후서', en: '2 Corinthians' },
  { bookId: 'GAL', testament: 'NT', ko: '갈라디아서', en: 'Galatians' },
  { bookId: 'EPH', testament: 'NT', ko: '에베소서', en: 'Ephesians' },
  { bookId: 'PHP', testament: 'NT', ko: '빌립보서', en: 'Philippians' },
  { bookId: 'COL', testament: 'NT', ko: '골로새서', en: 'Colossians' },
  { bookId: '1TH', testament: 'NT', ko: '데살로니가전서', en: '1 Thessalonians' },
  { bookId: '2TH', testament: 'NT', ko: '데살로니가후서', en: '2 Thessalonians' },
  { bookId: '1TI', testament: 'NT', ko: '디모데전서', en: '1 Timothy' },
  { bookId: '2TI', testament: 'NT', ko: '디모데후서', en: '2 Timothy' },
  { bookId: 'TIT', testament: 'NT', ko: '디도서', en: 'Titus' },
  { bookId: 'PHM', testament: 'NT', ko: '빌레몬서', en: 'Philemon' },
  { bookId: 'HEB', testament: 'NT', ko: '히브리서', en: 'Hebrews' },
  { bookId: 'JAS', testament: 'NT', ko: '야고보서', en: 'James' },
  { bookId: '1PE', testament: 'NT', ko: '베드로전서', en: '1 Peter' },
  { bookId: '2PE', testament: 'NT', ko: '베드로후서', en: '2 Peter' },
  { bookId: '1JN', testament: 'NT', ko: '요한일서', en: '1 John' },
  { bookId: '2JN', testament: 'NT', ko: '요한이서', en: '2 John' },
  { bookId: '3JN', testament: 'NT', ko: '요한삼서', en: '3 John' },
  { bookId: 'JUD', testament: 'NT', ko: '유다서', en: 'Jude' },
  { bookId: 'REV', testament: 'NT', ko: '요한계시록', en: 'Revelation' },
] as const;

export type KnownBookId = (typeof BOOKS)[number]['bookId'];

export const BOOK_IDS: readonly KnownBookId[] = BOOKS.map((b) => b.bookId);

const BY_ID: ReadonlyMap<string, (typeof BOOKS)[number]> = new Map(BOOKS.map((b) => [b.bookId, b]));

export function isKnownBookId(id: string): id is KnownBookId {
  return BY_ID.has(id);
}

/** bookId → 표시 이름. 모르는 id는 id 그대로 돌려준다(이름을 지어내지 않는다). */
export function bookName(bookId: string, lang: Lang): string {
  return BY_ID.get(bookId)?.[lang] ?? bookId;
}
