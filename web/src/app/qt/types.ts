/**
 * `GET /api/qt/today` 계약 v1(docs/contracts/qt-today.md)의 화면 쪽 타입.
 * 본문·제공처 해설 필드는 계약에 없으므로 여기에도 없다.
 */

export type BookId = string;

export interface QtVersePoint {
  chapter: number;
  verse: number;
}

/** domain의 VerseRange와 같은 모양(한 책 안의 연속 범위, 양 끝 포함). */
export interface QtVerseRange {
  bookId: BookId;
  start: QtVersePoint;
  end: QtVersePoint;
}

export type QtProviderId = 'maeil-seongyeong' | 'saengmyeong-ui-sam';

export const KNOWN_AVAILABILITY_STATUSES = [
  'RANGE_CONFIRMED',
  'RANGE_UNAVAILABLE',
  'RANGE_NOT_PERMITTED',
  'LINK_ERROR',
  'DISABLED',
] as const;

export type QtAvailabilityStatus = (typeof KNOWN_AVAILABILITY_STATUSES)[number];

/**
 * 화면용 상태. 계약에 없는 값은 `UNKNOWN`으로 받아 "확인하지 못함 + 링크"로 처리한다
 * (계약: 클라이언트는 모르는 값을 만나도 availabilityStatus만으로 동작해야 한다).
 */
export type QtViewStatus = QtAvailabilityStatus | 'UNKNOWN';

export type QtOfficialUrlKind = 'date-specific' | 'today-page';

export interface LocalizedText {
  ko: string;
  en: string;
}

export interface QtProvider {
  providerId: string;
  providerName: LocalizedText;
  providerTimeZone: string;
  /** 제공처가 그 자료를 오늘 것으로 표시한 날짜. 확인 못 하면 null. */
  providerDate: string | null;
  availabilityStatus: QtViewStatus;
  reasonCode: string | null;
  /** RANGE_CONFIRMED이고 유효할 때만 값이 있다. 그 외에는 항상 null(추정하지 않는다). */
  passage: { ranges: QtVerseRange[] } | null;
  displayReference: string | null;
  /** https가 아니면 null(버튼을 만들지 않는다). */
  officialUrl: string | null;
  /** 모르는 값이면 null. */
  officialUrlKind: QtOfficialUrlKind | null;
  verifiedAt: string | null;
  sourceVersion: string;
  notice: { ko?: string; en?: string } | null;
}

export interface QtTodayResponse {
  schemaVersion: '1';
  generatedAt: string;
  providers: QtProvider[];
}
