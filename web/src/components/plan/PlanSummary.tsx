import type { PlanResult } from '@/domain';
import { useI18n, type MessageKey } from '@/i18n';
import type { TodayState } from '@/app/plan/todayProgress';

const fmt = (n: number, lang: 'ko' | 'en', digits = 0) =>
  new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: digits }).format(n);

/** 진행률을 숫자와 함께 보여 주는 SVG 막대 차트. 색에만 의존하지 않도록 텍스트 대체와 범례를 함께 둔다. */
function ProgressChart({ read, total, pct, chapterOnly }: { read: number; total: number; pct: number; chapterOnly: boolean }) {
  const { lang, t } = useI18n();
  const remaining = Math.max(0, total - read);
  const w = total === 0 ? 0 : (read / total) * 300;
  return (
    <figure className="chart">
      <svg
        viewBox="0 0 300 28"
        role="img"
        aria-label={t(chapterOnly ? 'plan.chart.chapterLabel' : 'plan.chart.label', { read: fmt(read, lang), total: fmt(total, lang), pct: fmt(pct, lang, 1), remaining: fmt(remaining, lang) })}
        preserveAspectRatio="none"
        className="chart__svg"
      >
        <rect className="chart__remaining" x="0" y="0" width="300" height="28" rx="6" />
        <rect className="chart__read" x="0" y="0" width={w} height="28" rx="6" />
      </svg>
      <figcaption className="chart__legend">
        <span className="chart__key chart__key--read" aria-hidden="true" />
        {t(chapterOnly ? 'plan.chart.readChapters' : 'plan.chart.read')} {fmt(read, lang)}
        <span className="chart__key chart__key--remaining" aria-hidden="true" />
        {t(chapterOnly ? 'plan.chart.remainingChapters' : 'plan.chart.remaining')} {fmt(remaining, lang)}
      </figcaption>
    </figure>
  );
}

interface Props {
  result: PlanResult;
  today: TodayState;
  baseline: PlanResult | null;
  chapterOnly?: boolean;
}

export function PlanSummary({ result, today, baseline, chapterOnly = false }: Props) {
  const { lang, t } = useI18n();
  const s = result.summary;
  const verses = (n: number) => t('plan.summary.verses', { n: fmt(n, lang) });
  const chapters = (n: number) => t('plan.summary.chapters', { n: fmt(n, lang) });

  const todayTarget =
    today.kind === 'no-target' ? t('plan.summary.noTodayTarget') : (chapterOnly ? chapters(today.verses) : verses(today.verses));
  const todayAchievement =
    today.kind === 'no-target'
      ? t('plan.summary.na')
      : today.kind === 'not-entered'
        ? t('plan.summary.notEntered')
        : `${fmt(today.pct, lang, 1)}%`;

  const items: Array<[MessageKey, string]> = chapterOnly ? [
    ['plan.summary.progress', `${fmt(s.progressPct, lang, 1)}%`],
    ['plan.summary.targetChapters', chapters(s.targetChapters)],
    ['plan.summary.readChapters', chapters(s.targetChapters - s.remainingChapters)],
    ['plan.summary.remainingChaptersPlain', chapters(s.remainingChapters)],
    ['plan.summary.readingDays', String(fmt(s.readingDays, lang))],
    ['plan.summary.assignedDays', String(fmt(s.assignedDays, lang))],
    ['plan.summary.avgChapters', s.avgVersesPerDay === null ? t('plan.summary.na') : t('plan.summary.chapters', { n: fmt(s.avgVersesPerDay, lang, 1) })],
    ['plan.summary.todayTarget', todayTarget],
    ['plan.summary.todayAchievement', todayAchievement],
  ] : [
    ['plan.summary.progress', `${fmt(s.progressPct, lang, 1)}%`],
    ['plan.summary.targetVerses', verses(s.targetVerses)],
    ['plan.summary.targetChapters', chapters(s.targetChapters)],
    ['plan.summary.readVerses', verses(s.readVerses)],
    ['plan.summary.remainingVerses', verses(s.remainingVerses)],
    ['plan.summary.remainingChapters', chapters(s.remainingChapters)],
    ['plan.summary.readingDays', String(fmt(s.readingDays, lang))],
    ['plan.summary.assignedDays', String(fmt(s.assignedDays, lang))],
    ['plan.summary.avg', s.avgVersesPerDay === null ? t('plan.summary.na') : t('plan.summary.verses', { n: fmt(s.avgVersesPerDay, lang, 1) })],
    ['plan.summary.todayTarget', todayTarget],
    ['plan.summary.todayAchievement', todayAchievement],
  ];

  return (
    <section className="plan-summary" aria-labelledby="plan-summary-heading">
      <h4 id="plan-summary-heading">{t('plan.summary.heading')}</h4>
      <ProgressChart read={s.readVerses} total={s.targetVerses} pct={s.progressPct} chapterOnly={chapterOnly} />
      <dl className="plan-summary__highlights">
        <div><dt>{t('plan.summary.progress')}</dt><dd>{fmt(s.progressPct, lang, 1)}%</dd></div>
        <div><dt>{t(chapterOnly ? 'plan.summary.readChapters' : 'plan.summary.readVerses')}</dt><dd>{chapterOnly ? chapters(s.targetChapters - s.remainingChapters) : verses(s.readVerses)}</dd></div>
        <div><dt>{t(chapterOnly ? 'plan.summary.remainingChaptersPlain' : 'plan.summary.remainingVerses')}</dt><dd>{chapterOnly ? chapters(s.remainingChapters) : verses(s.remainingVerses)}</dd></div>
        <div><dt>{t('plan.summary.todayTarget')}</dt><dd>{todayTarget}</dd></div>
      </dl>
      <details className="plan-summary__details">
        <summary>{t('plan.summary.moreDetails')}</summary>
      <dl className="stat-grid">
        {items.map(([key, value]) => (
          <div key={key} className="stat">
            <dt>{t(key)}</dt>
            <dd data-stat={key}>{value}</dd>
          </div>
        ))}
      </dl>

      {result.recalculatedFrom ? (
        <p className="plan-banner" role="status">
          {t('plan.result.recalculated', { date: result.recalculatedFrom })}
        </p>
      ) : (
        <p className="qt-note">{t('plan.result.firstPlan')}</p>
      )}

      {baseline && result.recalculatedFrom && (
        <table className="compare">
          <caption>{t('plan.compare.heading')}</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">{t('plan.compare.first')}</th>
              <th scope="col">{t('plan.compare.current')}</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['plan.compare.readingDays', (r: PlanResult) => fmt(r.summary.readingDays, lang)],
                [chapterOnly ? 'plan.compare.remainingChapters' : 'plan.compare.remainingVerses', (r: PlanResult) => fmt(r.summary.remainingVerses, lang)],
                [chapterOnly ? 'plan.compare.avgChapters' : 'plan.compare.avg', (r: PlanResult) => (r.summary.avgVersesPerDay === null ? '-' : fmt(r.summary.avgVersesPerDay, lang, 1))],
              ] as const
            ).map(([key, get]) => (
              <tr key={key}>
                <th scope="row">{t(key)}</th>
                <td>{get(baseline)}</td>
                <td>{get(result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </details>
    </section>
  );
}
