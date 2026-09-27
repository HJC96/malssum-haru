# 계약: 일독 계획 입력·결과 (브라우저 순수 함수)

- 계약 버전: `1` (2026-09-24, lead 작성 v1-draft; v1.1: INVALID_DATE·PERIOD_TOO_LONG 추가, isPartialChapter(bible, ranges, bookId, chapter): boolean 확정, 추가 공개 API verseCount/unionRanges/subtractRanges/intersectRanges/validateRange/validateBibleData 허용)
- 관련: PRD PLAN01·02·03·05·06, CAL01, STAT01, EXP01·02, AC03~AC06·AC08·AC10·AC17·AC23·AC24
- 소유: 계약 문서는 lead, 구현은 planner-core(`web/src/domain/**`), 소비는 web-experience.
- 이 계약은 **TypeScript 시그니처**다. planner-core는 `web/src/domain/types.ts`에 같은 타입을 그대로 구현하고 `web/src/domain/index.ts`로 공개한다. web-experience는 이 공개 API만 import한다.

## 원칙

1. 모든 함수는 **순수 함수**다. `Date.now()`, `new Date()`(인자 없는), 난수, 저장소, 네트워크, `console` 로깅을 쓰지 않는다. 오늘 날짜는 입력 `asOf`로 주입한다.
2. 날짜는 `YYYY-MM-DD` 문자열이다. 시간대 변환을 하지 않는다. 요일은 그 날짜의 달력 요일(0=일 … 6=토)이다.
3. 책은 `bookId`(USFM 3글자 대문자, `GEN`…`REV`)다. 성경 데이터는 `BibleData`(버전 포함)로 주입하고, 계획 결과에 `dataVersion`을 고정한다.
4. 개인 입력(읽은 범위 포함)을 어디에도 저장·전송하지 않는다. 이 모듈은 I/O가 없다.
5. QT 열람은 입력에 없다. 계획 결과는 QT와 무관하다.
6. 화면·Excel·PDF는 모두 `PlanResult` 하나에서 만든다. 소비자는 배분 계산을 재구현하지 않는다.

## 타입

```ts
export type BookId = string;            // 'GEN' | 'EXO' | ... | 'REV'
export type IsoDate = string;           // 'YYYY-MM-DD'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface VersePoint { chapter: number; verse: number }
/** 한 책 안의 연속 범위. 양 끝 포함. */
export interface VerseRange { bookId: BookId; start: VersePoint; end: VersePoint }

export interface BibleData {
  dataVersion: string;                  // 예: 'sample-0' (검증 전 테스트 데이터) | 확정 데이터 버전
  versificationSystem: string;          // 장절 기준 이름
  books: ReadonlyArray<{
    bookId: BookId;
    testament: 'OT' | 'NT';
    order: number;                      // 정규 성경 순서 1..66
    chapterVerseCounts: ReadonlyArray<number>; // index 0 = 1장의 절 수
  }>;
}

export type TargetScope =
  | { kind: 'all' }
  | { kind: 'ot' }
  | { kind: 'nt' }
  | { kind: 'books'; bookIds: BookId[] };  // 배열 순서 = 사용자가 고른 읽는 순서

export type ReadInput =
  | { mode: 'none' }
  | { mode: 'continuous'; through: { bookId: BookId; chapter: number; verse: number } } // 목표 범위 시작 ~ through
  | { mode: 'ranges'; ranges: VerseRange[] };   // 겹침 허용, 합집합으로 계산

export type Distribution = 'chapters' | 'verses'; // 'verses' = 장 중간에서도 끊을 수 있는 절 단위 배분

export interface PlanInput {
  bible: BibleData;
  target: TargetScope;
  startDate: IsoDate;
  endDate: IsoDate;                     // 양 끝 포함
  weekdays: Weekday[];                  // 읽는 요일
  excludedDates: IsoDate[];
  distribution: Distribution;
  read: ReadInput;                      // 현재 읽은 분량(이번 화면 입력만)
  asOf?: IsoDate;                       // 있으면 재계산: max(asOf, startDate)부터 배정
  todayRead?: VerseRange[];             // 오늘 읽었다고 입력한 범위(없으면 '미입력')
}

export type DayStatus =
  | 'assigned'   // 읽기 날짜이고 배정 범위 있음
  | 'empty'      // 읽기 날짜지만 배정 없음(장 수 < 날짜 수 등). 미완료가 아니다
  | 'off'        // 요일/제외일로 읽지 않는 날
  | 'elapsed';   // asOf 이전 날짜(재계산 시). 읽었다/못 읽었다를 추정하지 않는다

export interface PlanDay {
  date: IsoDate;
  weekday: Weekday;
  status: DayStatus;
  ranges: VerseRange[];                 // status !== 'assigned'면 []
  verseCount: number;
  chapterCount: number;                 // 걸친 장 수(부분 장 포함)
  partialChapters: Array<{ bookId: BookId; chapter: number }>; // 장 전체가 아니라 일부만 배정된 장
}

export interface PlanSummary {
  targetChapters: number;
  targetVerses: number;
  readVerses: number;                   // 목표 안에서 중복 없이 읽은 절
  remainingVerses: number;
  remainingChapters: number;            // 전부 읽지 않은 장(부분 읽은 장 포함)
  progressPct: number;                  // 0..100, 100 초과 없음
  readingDays: number;                  // 배정 대상이 되는 읽기 날짜 수(asOf 반영)
  assignedDays: number;
  avgVersesPerDay: number | null;       // 남은 절 / readingDays, readingDays가 0이면 null
  todayTarget: { verses: number; ranges: VerseRange[] } | null; // asOf 날짜의 배정, 없으면 null
  todayAchievementPct: number | null;   // todayRead 미입력이면 null(0%가 아니다). 오늘 목표 없으면 null
}

export type PlanErrorCode =
  | 'START_AFTER_END'
  | 'NO_READING_DAYS'
  | 'EMPTY_SCOPE'
  | 'UNKNOWN_BOOK'
  | 'INVALID_RANGE'          // 장/절이 데이터에 없음, start > end 등
  | 'READ_OUTSIDE_TARGET'    // 읽은 범위가 목표 밖
  | 'NO_DAYS_LEFT_WITH_REMAINING' // asOf 이후 읽기 날짜 0개인데 미독이 남음 → 마감일 변경 안내
  | 'INVALID_DATE'          // 'YYYY-MM-DD'가 아니거나 없는 날짜. detail {field, value} (v1.1, planner-core 제안 승인)
  | 'PERIOD_TOO_LONG';      // 기간 > 3660일. detail {days, max} (v1.1)

export interface PlanError { code: PlanErrorCode; detail?: Record<string, string | number> }

export interface PlanResult {
  contractVersion: '1';
  dataVersion: string;
  versificationSystem: string;
  distribution: Distribution;
  recalculatedFrom: IsoDate | null;     // asOf를 반영했으면 그 날짜(최초 계획과 구분해 표시)
  summary: PlanSummary;
  remainingRanges: VerseRange[];        // 배정 대상 = 목표 − 읽은 범위, 성경/사용자 순서
  days: PlanDay[];                      // startDate..endDate의 모든 날짜, 날짜순
}

export type PlanOutcome =
  | { ok: true; result: PlanResult }
  | { ok: false; errors: PlanError[] };

export function computePlan(input: PlanInput): PlanOutcome;
```

## 불변식 (planner-core는 property 스타일 테스트로 검증한다)

1. `days[*].ranges`의 절 집합의 합집합 = `remainingRanges`의 절 집합. 날짜 사이 중복 없음. 성경(또는 지정) 순서 유지.
2. `Σ days[*].verseCount = summary.remainingVerses` (단, `NO_DAYS_LEFT_WITH_REMAINING`이면 오류).
3. `0 ≤ progressPct ≤ 100`. `targetVerses = readVerses + remainingVerses`.
4. 요일·제외일로 읽지 않는 날은 `off`, 읽는 날인데 배정이 없으면 `empty`. `off`/`empty`/`elapsed`는 완료·미완료로 표기하지 않는다.
5. `distribution: 'chapters'`는 장 단위(부분 장이 없는 한)로 나누고, `'verses'`는 남은 절을 읽기 날짜에 고르게 나눈다. 절 단위에서는 한 장이 여러 날에 걸칠 수 있다.
6. `todayRead`가 없으면 `todayAchievementPct`는 `null`이다. 오늘 배정이 없으면 `null`이다. 0으로 나누지 않는다.
7. 같은 입력 → 항상 같은 출력.

## 화면이 쓰는 보조 API (planner-core 제공)

```ts
export function formatRange(r: VerseRange, bookName: (id: BookId) => string): string; // 예: "요한복음 3:1–4:54"
export function listBooks(bible: BibleData): Array<{ bookId: BookId; testament: 'OT'|'NT'; order: number }>;
export function isPartialChapter(...): boolean;   // 필요 시
export const SAMPLE_BIBLE: BibleData;             // 테스트/개발용 작은 데이터. dataVersion = 'sample-0'
```

`formatRange`는 언어 중립 기본 표기(예: `JHN 3:1–4:54` 형태의 bookName 콜백 결과)만 만든다. 한/영 구분자·다중 범위 연결 등 **현지화된 표기는 web-experience의 `web/src/i18n`이 소유**한다(표시 전용이며 계산이 아니므로 domain 재구현 금지 원칙에 해당하지 않는다).

책 이름 문자열은 `web/src/i18n`(web-experience)이 `bookId → 이름`으로 제공한다. domain은 이름을 갖지 않는다.

## 변경 절차

계약 변경이 필요하면 담당 팀원이 lead에게 메시지로 제안 → lead가 이 문서를 고치고 planner-core·web-experience에 함께 알린다. 한쪽이 임의로 타입을 바꾸지 않는다.

## 해석 합의 (planner-core 제안 승인, 2026-09-24)

- `chapters`: 남은 장 N개·읽기 날짜 D일이면 앞쪽 (N mod D)일이 하나 더 받고, N<D면 앞에서부터 하루 한 장, 나머지는 `empty`.
- `verses`: 남은 절 V개를 날짜 순으로 고르게 배분한다. 앞쪽 (V mod D)일에 한 절씩 더 배정하며, V<D면 뒤쪽은 `empty`. 장 중간에서도 날짜별 범위를 끊을 수 있다.
- `asOf`: max(asOf, startDate) 이전은 요일과 무관하게 `elapsed`. `recalculatedFrom`은 asOf가 startDate보다 뒤일 때만 값, 아니면 null. 이후 읽기 날짜 0개 + 미독 있음 → `NO_DAYS_LEFT_WITH_REMAINING`, 미독 0이면 정상(avgVersesPerDay null). `NO_READING_DAYS`는 전체 기간 기준.
- `todayTarget`: asOf 없거나 그날이 `assigned`가 아니면 null. `todayRead`는 undefined/빈 배열이면 미입력(null 달성률)이며 `remainingRanges`에서 빼지 않는다(오늘 목표의 분모 고정, PRD 8장). 달성률 = |todayRead ∩ todayTarget| ÷ |todayTarget|.
- `progressPct`·`avgVersesPerDay`는 반올림 없는 원값. 반올림은 화면 책임.
- `target.books` 중복은 첫 등장만. 오류는 독립적인 것끼리 모아 반환.

추가 공개 API(승인): verseCount, unionRanges, subtractRanges, intersectRanges, normalizeRanges, isWithin, validateRange, isPartialChapter, bibleTotals, validateBibleData, MAX_PERIOD_DAYS(3660), addDays, weekdayOf, isLeapYear, daysInMonth, isValidIsoDate. bookId는 `web/src/i18n/books.ts`의 USFM 3글자 표(예: 아가 SNG, 에스겔 EZK, 요엘 JOL, 나훔 NAM, 빌립보서 PHP, 요한일서 1JN)와 실제 66권 데이터(T10)가 동일해야 한다.
