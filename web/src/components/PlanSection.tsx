import { useMemo, useRef, useState } from 'react';
import type { BibleData, PlanResult, Weekday } from '@/domain';
import { computePlan } from '@/domain';
import { localIsoDate, useI18n } from '@/i18n';
import { BIBLE, dataStatusOf } from '@/app/plan/bibleSource';
import { baselineInput, computeFromForm, defaultForm, type PlanFormState } from '@/app/plan/planForm';
import { todayState } from '@/app/plan/todayProgress';
import { buildExportModel } from '@/export/planExport';
import { ExportPanel } from './plan/ExportPanel';
import { PlanForm } from './plan/PlanForm';
import { PlanIssues } from './plan/PlanIssues';
import { PlanPrintSheet } from './plan/PlanPrintSheet';
import { PlanSummary } from './plan/PlanSummary';
import { PlanScheduleView } from './plan/PlanScheduleView';
import { ProgressEditor, type ProgressFields } from './plan/ProgressEditor';

type View = 'list' | 'calendar';
type MobilePanel = 'setup' | 'result';

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
  const [scheduleProgress, setScheduleProgress] = useState<ProgressFields>(() => ({
    readMode: initialForm?.readMode ?? defaultForm(today).readMode,
    through: initialForm?.through ?? defaultForm(today).through,
    readRanges: initialForm?.readRanges ?? defaultForm(today).readRanges,
    todayRead: initialForm?.todayRead ?? defaultForm(today).todayRead,
  }));
  const [scheduleAsOf, setScheduleAsOf] = useState<string | null>(() => (initialForm?.recalc ? today : null));
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [view, setView] = useState<View>('list');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('setup');
  const [weekStart, setWeekStart] = useState<Weekday>(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const status = dataStatusOf(bible);
  const computed = useMemo(
    () => computeFromForm({ ...form, ...scheduleProgress, recalc: scheduleAsOf !== null }, bible, today),
    [form, scheduleProgress, scheduleAsOf, bible, today],
  );
  const progressComputed = useMemo(() => computeFromForm({ ...form, recalc: false }, bible, today), [form, bible, today]);
  const previewPlan = useMemo(() => computeFromForm({ ...form, recalc: true }, bible, today), [form, bible, today]);

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
    ? todayState(
        { ...computed.outcome.result, summary: { ...computed.outcome.result.summary, todayTarget: null, todayAchievementPct: null } },
        bible,
        today,
        progressComputed.ok ? progressComputed.input.todayRead ?? [] : [],
      )
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

      <div className="plan-workspace">
      <div className="plan-mobile-tabs" role="group" aria-label={t('plan.heading')}>
        {(['setup', 'result'] as MobilePanel[]).map((panel) => (
          <button key={panel} type="button" aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>
            {t(panel === 'setup' ? 'plan.quick.panel.setup' : 'plan.quick.panel.result')}
          </button>
        ))}
      </div>
      <div className="plan-setup-panel" data-mobile-active={mobilePanel === 'setup'}>
      <PlanForm
        form={form}
        onChange={setForm}
        bible={bible}
        preview={computed.ok ? {
          verses: computed.outcome.result.summary.targetVerses,
          days: computed.outcome.result.summary.readingDays,
          average: computed.outcome.result.summary.readingDays > 0
            ? computed.outcome.result.summary.targetVerses / computed.outcome.result.summary.readingDays
            : null,
        } : undefined}
        onPreview={() => {
          setMobilePanel('result');
          window.requestAnimationFrame(() => {
            resultHeading.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
            resultHeading.current?.focus({ preventScroll: true });
          });
        }}
      />

      {!computed.ok && <PlanIssues issues={computed.issues} />}
      {computed.ok && !progressComputed.ok && <PlanIssues issues={progressComputed.issues} />}
      </div>

      {computed.ok && model && todayInfo && (
        <div className="plan-result" data-mobile-active={mobilePanel === 'result'} aria-labelledby="plan-result-heading" role="region">
          <h3 id="plan-result-heading" ref={resultHeading} tabIndex={-1}>{t('plan.result.heading')}</h3>
          <PlanSummary
            result={progressComputed.ok
              ? { ...progressComputed.outcome.result, recalculatedFrom: computed.outcome.result.recalculatedFrom }
              : computed.outcome.result}
            today={todayInfo}
            baseline={baseline}
          />
          <ProgressEditor
            form={form}
            bible={bible}
            onApply={(fields) => {
              const candidate = { ...form, ...fields, recalc: false };
              const validation = computeFromForm(candidate, bible, today);
              if (!validation.ok) {
                setForm(candidate);
                return false;
              }
              setForm(candidate);
              return true;
            }}
          />
          <section className="schedule-adjustment" aria-label={t('plan.recalc.previewTitle')}>
            <button type="button" className="btn btn--small" onClick={() => setShowSchedulePreview((shown) => !shown)}>
              {t('plan.recalc.preview')}
            </button>
            {showSchedulePreview && (
              <div className="schedule-adjustment__preview" role="region" aria-label={t('plan.recalc.previewTitle')}>
                <h4>{t('plan.recalc.previewTitle')}</h4>
                {previewPlan.ok ? (
                  <>
                    <p>{t('plan.recalc.previewBody', { date: today, days: previewPlan.outcome.result.summary.readingDays, verses: previewPlan.outcome.result.summary.remainingVerses })}</p>
                    <p className="qt-note">{t('plan.result.recalculated', { date: today })}</p>
                    <button type="button" className="btn" onClick={() => { setScheduleProgress({ readMode: form.readMode, through: form.through, readRanges: form.readRanges, todayRead: form.todayRead }); setScheduleAsOf(today); setShowSchedulePreview(false); }}>{t('plan.recalc.apply')}</button>
                  </>
                ) : (
                  <p className="plan-issues" role="alert">{t('plan.recalc.noDays')}</p>
                )}
                <button type="button" className="btn btn--small" onClick={() => setShowSchedulePreview(false)}>{t('plan.recalc.cancel')}</button>
              </div>
            )}
          </section>

          <div className="view-tabs" role="group" aria-label={t('plan.view.label')}>
            {(['list', 'calendar'] as View[]).map((v) => (
              <button key={v} type="button" className="view-tabs__btn" aria-pressed={view === v} onClick={() => setView(v)}>
                {t(v === 'list' ? 'plan.view.list' : 'plan.view.calendar')}
              </button>
            ))}
          </div>
          <PlanScheduleView rows={model.rows} today={today} view={view} weekStart={weekStart} onWeekStartChange={setWeekStart} />

          <ExportPanel model={model} weekStart={weekStart} />
          <PlanPrintSheet model={model} />
        </div>
      )}
      {!computed.ok && <div className="plan-result plan-result--empty" data-mobile-active={mobilePanel === 'result'} role="status">{t('plan.quick.resultHint')}</div>}
      </div>
    </section>
  );
}
