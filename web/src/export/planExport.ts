import type { DayStatus, IsoDate, PlanResult, Weekday } from '@/domain';
import { bookName, formatPassageText, translate, type Lang, type MessageKey } from '@/i18n';

/**
 * 화면(목록·캘린더·인쇄), Excel, PDF가 모두 이 모델의 행을 쓴다(AC10, AC17).
 * 배분은 이미 `PlanResult.days`에 끝나 있으므로 여기서는 표시 문자열만 만들고 다시 계산하지 않는다.
 */
export interface ExportRow {
  date: IsoDate;
  weekday: Weekday;
  weekdayLabel: string;
  status: DayStatus;
  /** 배정이 있는 날만 값이 있다. */
  rangeText: string;
  /** off/empty/elapsed의 상태 문구. assigned면 ''. 완료·미완료로 쓰지 않는다. */
  statusLabel: string;
  /** 표에 그대로 쓰는 문자열: 범위가 있으면 범위, 없으면 상태 문구. */
  displayText: string;
  verseCount: number;
  chapterCount: number;
  /** 부분 장 표시(예: "창세기 3장, 시편 2장"). 없으면 ''. */
  partialText: string;
}

export interface ExportMeta {
  planName: string;
  lang: Lang;
  languageLabel: string;
  startDate: IsoDate;
  endDate: IsoDate;
  versificationSystem: string;
  dataVersion: string;
  basisLabel: string;
  recalculatedLabel: string;
  generatedOn: IsoDate;
  remainingVerses: number;
  readingDays: number;
}

export interface ExportModel {
  meta: ExportMeta;
  rows: ExportRow[];
}

export interface BuildExportOptions {
  lang: Lang;
  planName: string;
  /** 생성일(YYYY-MM-DD). 시계를 읽지 않고 호출 쪽이 넘긴다. */
  generatedOn: IsoDate;
}

const STATUS_KEY: Record<Exclude<DayStatus, 'assigned'>, MessageKey> = {
  off: 'export.status.off',
  empty: 'export.status.empty',
  elapsed: 'export.status.elapsed',
};

export function buildExportModel(result: PlanResult, opts: BuildExportOptions): ExportModel {
  const { lang } = opts;
  const t = (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params);

  const rows: ExportRow[] = result.days.map((d) => {
    const assigned = d.status === 'assigned';
    const rangeText = assigned ? formatPassageText(d.ranges, lang) : '';
    const statusLabel = d.status === 'assigned' ? '' : t(STATUS_KEY[d.status]);
    return {
      date: d.date,
      weekday: d.weekday,
      weekdayLabel: t(`export.weekday.${d.weekday}` as MessageKey),
      status: d.status,
      rangeText,
      statusLabel,
      displayText: rangeText || statusLabel,
      verseCount: d.verseCount,
      chapterCount: d.chapterCount,
      partialText: d.partialChapters
        .map((p) => t('plan.day.chapterLabel', { book: bookName(p.bookId, lang), chapter: p.chapter }))
        .join(', '),
    };
  });

  const first = result.days[0];
  const last = result.days[result.days.length - 1];
  const name = opts.planName.trim();
  return {
    meta: {
      planName: name === '' ? t('export.defaultName') : name,
      lang,
      languageLabel: t(lang === 'ko' ? 'export.language.ko' : 'export.language.en'),
      startDate: first?.date ?? '',
      endDate: last?.date ?? '',
      versificationSystem: result.versificationSystem,
      dataVersion: result.dataVersion,
      basisLabel: t(result.distribution === 'verses' ? 'export.basis.verses' : 'export.basis.chapters'),
      recalculatedLabel: result.recalculatedFrom
        ? t('export.meta.recalculatedFrom', { date: result.recalculatedFrom })
        : t('export.meta.firstPlan'),
      generatedOn: opts.generatedOn,
      remainingVerses: result.summary.remainingVerses,
      readingDays: result.summary.readingDays,
    },
    rows,
  };
}

/** 내보낼 월 목록(YYYY-MM, 계획 기간 안의 달). */
export function monthsOf(model: ExportModel): string[] {
  const seen: string[] = [];
  for (const r of model.rows) {
    const ym = r.date.slice(0, 7);
    if (seen[seen.length - 1] !== ym) seen.push(ym);
  }
  return seen;
}

/** 월을 고르면 그 달의 행만, null이면 전체. */
export function rowsForMonth(model: ExportModel, month: string | null): ExportRow[] {
  return month ? model.rows.filter((r) => r.date.startsWith(month)) : model.rows;
}

/** 파일 이름에 쓸 수 없는 문자를 바꾼다. */
export function safeFileStem(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned === '' ? 'plan' : cleaned.slice(0, 60);
}

export function exportFileName(model: ExportModel, ext: 'xlsx' | 'pdf', month: string | null, suffix = ''): string {
  const { planName, startDate, endDate } = model.meta;
  const span = month ?? `${startDate}_${endDate}`;
  return `${safeFileStem(planName)}-${span}${suffix}.${ext}`;
}
