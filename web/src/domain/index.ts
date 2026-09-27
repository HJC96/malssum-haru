// 성경 읽기 계획 계산 엔진의 공개 API. 화면·내보내기는 이 모듈만 import한다(계약: docs/contracts/plan-result.md).
export type {
  BibleData,
  BookId,
  DayStatus,
  Distribution,
  IsoDate,
  PlanDay,
  PlanError,
  PlanErrorCode,
  PlanInput,
  PlanOutcome,
  PlanResult,
  PlanSummary,
  ReadInput,
  TargetScope,
  VersePoint,
  VerseRange,
  Weekday,
} from './types';
export { computePlan, MAX_PERIOD_DAYS } from './plan';
export { formatRange } from './format';
export { bibleDataStatus, bibleTotals, canonicalString, CANON_TOTALS, listBooks, validateAgainstCanon, validateBibleData, validateCanonList } from './bibleData';
export type { BibleDataProblem, BibleTotals, CanonBook } from './bibleData';
export {
  intersectRanges,
  isPartialChapter,
  isWithin,
  normalizeRanges,
  subtractRanges,
  unionRanges,
  validateRange,
  verseCount,
} from './ranges';
export { addDays, daysInMonth, isLeapYear, isValidIsoDate, weekdayOf } from './dates';
export { SAMPLE_BIBLE } from '../data/sampleBible';
export { NKRV_PROVISIONAL } from '../data/nkrvProvisional';
export { DEFAULT_BIBLE } from '../data/defaultBible';
