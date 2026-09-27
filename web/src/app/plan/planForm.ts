import {
  addDays,
  computePlan,
  type BibleData,
  type Distribution,
  type IsoDate,
  type PlanError,
  type PlanInput,
  type PlanOutcome,
  type ReadInput,
  type TargetScope,
  type VerseRange,
  type Weekday,
} from '@/domain';

/**
 * 계획 입력 폼 상태. 화면 언어와 무관한 값(ISO 날짜, bookId, 숫자 문자열)만 담고 메모리에만 둔다(AC18, AC20).
 */
export interface RangeDraft {
  bookId: string;
  startChapter: string;
  startVerse: string;
  endChapter: string;
  endVerse: string;
}

export type ScopeKind = 'all' | 'ot' | 'nt' | 'books';
export type ReadMode = 'none' | 'continuous' | 'ranges';

export interface PlanFormState {
  scopeKind: ScopeKind;
  /** scopeKind === 'books'일 때 읽는 순서. */
  bookIds: string[];
  startDate: string;
  endDate: string;
  weekdays: Weekday[];
  excludedDates: string[];
  distribution: Distribution;
  readMode: ReadMode;
  through: { bookId: string; chapter: string; verse: string };
  readRanges: RangeDraft[];
  /** true면 오늘 날짜를 asOf로 넘겨 남은 범위를 오늘부터 다시 배분한다. */
  recalc: boolean;
  todayRead: RangeDraft[];
  planName: string;
}

export const ALL_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const emptyRange = (bookId = ''): RangeDraft => ({
  bookId,
  startChapter: '',
  startVerse: '',
  endChapter: '',
  endVerse: '',
});

/** 기본값: 오늘부터 364일 뒤까지(365일), 매일, 장 수 배분, 처음 시작. */
export function defaultForm(today: IsoDate): PlanFormState {
  return {
    scopeKind: 'all',
    bookIds: [],
    startDate: today,
    endDate: addDays(today, 364),
    weekdays: [...ALL_WEEKDAYS],
    excludedDates: [],
    distribution: 'chapters',
    readMode: 'none',
    through: { bookId: '', chapter: '', verse: '' },
    readRanges: [emptyRange()],
    recalc: false,
    todayRead: [],
    planName: '',
  };
}

export type FormIssueCode = 'FORM_INCOMPLETE' | 'FORM_NOT_INTEGER';
export interface FormIssue {
  code: FormIssueCode;
  field: 'read' | 'todayRead';
}

/** 화면이 보여 줄 오류. 폼 단계(FORM_*)와 계산 단계(PlanError)를 같은 모양으로 다룬다. */
export type PlanIssue = { code: FormIssueCode; field: string } | (PlanError & { field?: string });

const isBlank = (r: RangeDraft, chapterOnly = false) =>
  r.startChapter.trim() === '' && r.endChapter.trim() === '' &&
  (chapterOnly || (r.startVerse.trim() === '' && r.endVerse.trim() === ''));

const INT = /^[1-9]\d*$/;

type RangeParse = { ok: true; ranges: VerseRange[] } | { ok: false; code: FormIssueCode };

/** 완전히 빈 행은 무시하고, 채우다 만 행은 오류로 돌려준다. */
function parseRanges(drafts: RangeDraft[], chapterOnly = false): RangeParse {
  const ranges: VerseRange[] = [];
  for (const d of drafts) {
    if (d.bookId === '' && isBlank(d, chapterOnly)) continue;
    const parts = (chapterOnly ? [d.startChapter, d.endChapter] : [d.startChapter, d.startVerse, d.endChapter, d.endVerse]).map((s) => s.trim());
    if (d.bookId === '' || parts.some((p) => p === '')) return { ok: false, code: 'FORM_INCOMPLETE' };
    if (!parts.every((p) => INT.test(p))) return { ok: false, code: 'FORM_NOT_INTEGER' };
    const [sc, sv, ec, ev] = chapterOnly
      ? [Number(d.startChapter), 1, Number(d.endChapter), 1]
      : parts.map(Number) as [number, number, number, number];
    ranges.push({ bookId: d.bookId, start: { chapter: sc, verse: sv }, end: { chapter: ec, verse: ev } });
  }
  return { ok: true, ranges };
}

function targetOf(form: PlanFormState): TargetScope {
  return form.scopeKind === 'books' ? { kind: 'books', bookIds: [...form.bookIds] } : { kind: form.scopeKind };
}

export type BuildResult = { ok: true; input: PlanInput } | { ok: false; issues: PlanIssue[] };

/**
 * 폼 상태를 계산 입력으로 바꾼다. 날짜·기간·범위 검증은 domain이 하므로 여기서는 재구현하지 않고,
 * 숫자 문자열이 정수인지, 행이 완성됐는지만 확인한다.
 * `today`는 화면이 주입한 오늘 날짜(YYYY-MM-DD)다.
 */
export function buildPlanInput(form: PlanFormState, bible: BibleData, today: IsoDate): BuildResult {
  const issues: PlanIssue[] = [];
  const chapterOnly = bible.versificationSystem === 'chapter-only-66';

  let read: ReadInput = { mode: 'none' };
  if (form.readMode === 'continuous') {
    const { bookId, chapter, verse } = form.through;
    if (bookId === '' || chapter.trim() === '' || (!chapterOnly && verse.trim() === '')) {
      issues.push({ code: 'FORM_INCOMPLETE', field: 'read' });
    } else if (!INT.test(chapter.trim()) || (!chapterOnly && !INT.test(verse.trim()))) {
      issues.push({ code: 'FORM_NOT_INTEGER', field: 'read' });
    } else {
      read = { mode: 'continuous', through: { bookId, chapter: Number(chapter), verse: chapterOnly ? 1 : Number(verse) } };
    }
  } else if (form.readMode === 'ranges') {
    const parsed = parseRanges(form.readRanges, chapterOnly);
    if (parsed.ok) read = { mode: 'ranges', ranges: parsed.ranges };
    else issues.push({ code: parsed.code, field: 'read' });
  }

  const todayParsed = parseRanges(form.todayRead, chapterOnly);
  if (!todayParsed.ok) issues.push({ code: todayParsed.code, field: 'todayRead' });

  if (issues.length > 0 || !todayParsed.ok) return { ok: false, issues };

  return {
    ok: true,
    input: {
      bible,
      target: targetOf(form),
      startDate: form.startDate,
      endDate: form.endDate,
      weekdays: [...form.weekdays],
      excludedDates: [...form.excludedDates],
      distribution: form.distribution,
      read,
      ...(form.recalc ? { asOf: today } : {}),
      ...(todayParsed.ranges.length > 0 ? { todayRead: todayParsed.ranges } : {}),
    },
  };
}

export type Computed =
  | { ok: true; input: PlanInput; outcome: Extract<PlanOutcome, { ok: true }> }
  | { ok: false; issues: PlanIssue[] };

/** 폼 → 입력 → domain 계산. 입력을 바꿀 때마다 즉시 다시 부른다. */
export function computeFromForm(form: PlanFormState, bible: BibleData, today: IsoDate): Computed {
  const built = buildPlanInput(form, bible, today);
  if (!built.ok) return built;
  const outcome = computePlan(built.input);
  if (!outcome.ok) {
    return {
      ok: false,
      issues: outcome.errors.map((e) => ({ ...e, ...(typeof e.detail?.field === 'string' ? { field: e.detail.field } : {}) })),
    };
  }
  return { ok: true, input: built.input, outcome };
}

/** 최초 계획(재계산 없음, 읽은 분량 없음)과 비교하기 위한 기준 입력. */
export function baselineInput(input: PlanInput): PlanInput {
  const { asOf: _asOf, todayRead: _todayRead, ...rest } = input;
  return { ...rest, read: { mode: 'none' } };
}
