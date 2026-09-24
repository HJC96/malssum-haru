// 계약: docs/contracts/plan-result.md (계약 버전 1). 타입을 바꾸려면 lead에게 제안한다.

export type BookId = string; // 'GEN' | 'EXO' | ... | 'REV'
export type IsoDate = string; // 'YYYY-MM-DD'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface VersePoint {
  chapter: number;
  verse: number;
}
/** 한 책 안의 연속 범위. 양 끝 포함. */
export interface VerseRange {
  bookId: BookId;
  start: VersePoint;
  end: VersePoint;
}

export interface BibleData {
  dataVersion: string; // 예: 'sample-0' (검증 전 테스트 데이터) | 확정 데이터 버전
  versificationSystem: string; // 장절 기준 이름
  books: ReadonlyArray<{
    bookId: BookId;
    testament: 'OT' | 'NT';
    order: number; // 정규 성경 순서 1..66
    chapterVerseCounts: ReadonlyArray<number>; // index 0 = 1장의 절 수
  }>;
}

export type TargetScope =
  | { kind: 'all' }
  | { kind: 'ot' }
  | { kind: 'nt' }
  | { kind: 'books'; bookIds: BookId[] }; // 배열 순서 = 사용자가 고른 읽는 순서

export type ReadInput =
  | { mode: 'none' }
  | { mode: 'continuous'; through: { bookId: BookId; chapter: number; verse: number } } // 목표 범위 시작 ~ through
  | { mode: 'ranges'; ranges: VerseRange[] }; // 겹침 허용, 합집합으로 계산

export type Distribution = 'chapters' | 'verses'; // 'verses' = 절 수를 고려하되 장 끝에서 마침(기본값)

export interface PlanInput {
  bible: BibleData;
  target: TargetScope;
  startDate: IsoDate;
  endDate: IsoDate; // 양 끝 포함
  weekdays: Weekday[]; // 읽는 요일
  excludedDates: IsoDate[];
  distribution: Distribution;
  read: ReadInput; // 현재 읽은 분량(이번 화면 입력만)
  asOf?: IsoDate; // 있으면 재계산: max(asOf, startDate)부터 배정
  todayRead?: VerseRange[]; // 오늘 읽었다고 입력한 범위(없으면 '미입력')
}

export type DayStatus =
  | 'assigned' // 읽기 날짜이고 배정 범위 있음
  | 'empty' // 읽기 날짜지만 배정 없음(장 수 < 날짜 수 등). 미완료가 아니다
  | 'off' // 요일/제외일로 읽지 않는 날
  | 'elapsed'; // asOf 이전 날짜(재계산 시). 읽었다/못 읽었다를 추정하지 않는다

export interface PlanDay {
  date: IsoDate;
  weekday: Weekday;
  status: DayStatus;
  ranges: VerseRange[]; // status !== 'assigned'면 []
  verseCount: number;
  chapterCount: number; // 걸친 장 수(부분 장 포함)
  partialChapters: Array<{ bookId: BookId; chapter: number }>; // 장 전체가 아니라 일부만 배정된 장
}

export interface PlanSummary {
  targetChapters: number;
  targetVerses: number;
  readVerses: number; // 목표 안에서 중복 없이 읽은 절
  remainingVerses: number;
  remainingChapters: number; // 전부 읽지 않은 장(부분 읽은 장 포함)
  progressPct: number; // 0..100, 100 초과 없음
  readingDays: number; // 배정 대상이 되는 읽기 날짜 수(asOf 반영)
  assignedDays: number;
  avgVersesPerDay: number | null; // 남은 절 / readingDays, readingDays가 0이면 null
  todayTarget: { verses: number; ranges: VerseRange[] } | null; // asOf 날짜의 배정, 없으면 null
  todayAchievementPct: number | null; // todayRead 미입력이면 null(0%가 아니다). 오늘 목표 없으면 null
}

export type PlanErrorCode =
  | 'START_AFTER_END'
  | 'NO_READING_DAYS'
  | 'EMPTY_SCOPE'
  | 'UNKNOWN_BOOK'
  | 'INVALID_RANGE' // 장/절이 데이터에 없음, start > end 등
  | 'READ_OUTSIDE_TARGET' // 읽은 범위가 목표 밖
  | 'NO_DAYS_LEFT_WITH_REMAINING' // asOf 이후 읽기 날짜 0개인데 미독이 남음 → 마감일 변경 안내
  | 'INVALID_DATE' // 계약 v1.1: 'YYYY-MM-DD'가 아니거나 없는 날짜. detail {field, value}
  | 'PERIOD_TOO_LONG'; // 계약 v1.1: 기간이 MAX_PERIOD_DAYS(3660) 초과. detail {days, max}

export interface PlanError {
  code: PlanErrorCode;
  detail?: Record<string, string | number>;
}

export interface PlanResult {
  contractVersion: '1';
  dataVersion: string;
  versificationSystem: string;
  distribution: Distribution;
  recalculatedFrom: IsoDate | null; // asOf를 반영했으면 그 날짜(최초 계획과 구분해 표시)
  summary: PlanSummary;
  remainingRanges: VerseRange[]; // 배정 대상 = 목표 − 읽은 범위, 성경/사용자 순서
  days: PlanDay[]; // startDate..endDate의 모든 날짜, 날짜순
}

export type PlanOutcome = { ok: true; result: PlanResult } | { ok: false; errors: PlanError[] };
