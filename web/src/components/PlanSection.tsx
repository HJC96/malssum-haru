import { useMemo, useState } from 'react';
import type { BibleData, PlanResult, Weekday } from '@/domain';
import { computePlan } from '@/domain';
import { localIsoDate, useI18n } from '@/i18n';
import { BIBLE, dataStatusOf } from '@/app/plan/bibleSource';
import { baselineInput, computeFromForm, defaultForm, type PlanFormState } from '@/app/plan/planForm';
import { todayState } from '@/app/plan/todayProgress';
import { buildExportModel } from '@/export/planExport';
import { ExportPanel } from './plan/ExportPanel';
import { PlanCalendar } from './plan/PlanCalendar';
import { PlanDayList } from './plan/PlanDayList';
import { PlanForm } from './plan/PlanForm';
import { PlanIssues } from './plan/PlanIssues';
import { PlanPrintSheet } from './plan/PlanPrintSheet';
import { PlanSummary } from './plan/PlanSummary';

type View = 'list' | 'calendar';

/**
 * 일독 계획 영역. 입력과 결과는 이 컴포넌트의 메모리 상태로만 있고 저장소·URL·서버로 나가지 않는다(AC20).
 * QT 영역과 상태를 공유하지 않는다(AC01). 언어는 표시 문자열에만 영향을 주며 폼 상태는 그대로다(AC18).
 */
interface Props {
  now?: Date;
  /** 테스트에서 폼 초기값을 바꾼다. */
  initialForm?: Partial<PlanFormState>;
  /** 테스트에서 성경 데이터를 바꾼다. 기본은 앱 데이터(BIBLE). */
  bible?: BibleData;
}

export function PlanSection({ now, initialForm, bible = BIBLE }: Props) {
  const { lang, t } = useI18n();
  const today = localIsoDate(now ?? new Date());
  const [form, setForm] = useState<PlanFormState>(() => ({ ...defaultForm(today), ...initialForm }));
  const [view, setView] = useState<View>('list');
  const [weekStart, setWeekStart] = useState<Weekday>(0);

  const status = dataStatusOf(bible);
  const computed = useMemo(() => computeFromForm(form, bible, today), [form, bible, today]);

  const baseline: PlanResult | null = useMemo(() => {
    if (!computed.ok || !computed.outcome.result.recalculatedFrom) return null;
    const out = computePlan(baselineInput(computed.input));
    return out.ok ? out.result : null;
  }, [computed]);

  const model = useMemo(
    () => (computed.ok ? buildExportModel(computed.outcome.result, { lang, planName: form.planName, generatedOn: today }) : null),
    [computed, lang, form.planName, today],
  );

  const todayInfo = computed.ok
    ? todayState(computed.outcome.result, bible, today, computed.input.todayRead ?? [])
    : null;

  return (
    <section className="plan-section" aria-labelledby="plan-heading">
      <h2 id="plan-heading">{t('plan.heading')}</h2>
      <p className="qt-note">{t('plan.intro')}</p>
      {status !== 'confirmed' && (
        <p className={`plan-banner plan-banner--${status}`} role="note">
          {t(status === 'sample' ? 'plan.sampleBanner' : 'plan.provisionalBanner')}
        </p>
      )}
      <p className="qt-note">{t('plan.dataInfo', { system: bible.versificationSystem, version: bible.dataVersion })}</p>
      <details className="data-help">
        <summary>{t('plan.dataHelp.summary')}</summary>
        <p className="qt-note">{t('plan.dataHelp.body')}</p>
        {status === 'provisional' && <p className="qt-note">{t('plan.dataHelp.limits')}</p>}
      </details>

      <PlanForm form={form} onChange={setForm} bible={bible} today={today} />

      {!computed.ok && <PlanIssues issues={computed.issues} />}

      {computed.ok && model && todayInfo && (
        <div className="plan-result" aria-labelledby="plan-result-heading" role="region">
          <h3 id="plan-result-heading">{t('plan.result.heading')}</h3>
          <PlanSummary result={computed.outcome.result} today={todayInfo} baseline={baseline} />

          <div className="view-tabs" role="group" aria-label={t('plan.view.label')}>
            {(['list', 'calendar'] as View[]).map((v) => (
              <button key={v} type="button" className="view-tabs__btn" aria-pressed={view === v} onClick={() => setView(v)}>
                {t(v === 'list' ? 'plan.view.list' : 'plan.view.calendar')}
              </button>
            ))}
          </div>
          {view === 'list' ? (
            <PlanDayList rows={model.rows} />
          ) : (
            <PlanCalendar rows={model.rows} today={today} weekStart={weekStart} onWeekStartChange={setWeekStart} />
          )}

          <ExportPanel model={model} weekStart={weekStart} />
          <PlanPrintSheet model={model} />
        </div>
      )}
      {!computed.ok && <p className="qt-note">{t('plan.export.noPlan')}</p>}
    </section>
  );
}
