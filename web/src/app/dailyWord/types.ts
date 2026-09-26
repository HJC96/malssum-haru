/** Date-keyed, reviewed daily Scripture content. This type describes data only; it grants no content-use rights. */
export interface DailyWordReference {
  bookId: string;
  chapter: number;
  verse: number;
}

export interface DailyWordEntry {
  reference: DailyWordReference;
  translationId: string;
  textLanguage: 'ko' | 'en';
  text: string;
  explanation: {
    text: string;
    kind: 'reviewed' | 'editorial';
    language: 'ko' | 'en';
  };
  source: {
    name: string;
    url: string;
  };
}

export interface DailyWordContent {
  schemaVersion: '1';
  date: string;
  timeZone: 'Asia/Seoul';
  contentVersion: string;
  oldTestament: DailyWordEntry;
  newTestament: DailyWordEntry;
}

export type DailyWordTestament = 'oldTestament' | 'newTestament';
