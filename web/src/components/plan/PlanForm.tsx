import { useId, useState } from 'react';
import { addDays, listBooks, type BibleData, type Distribution, type Weekday } from '@/domain';
import { bookName, useI18n, type MessageKey } from '@/i18n';
import { ALL_WEEKDAYS, type PlanFormState, type ScopeKind } from '@/app/plan/planForm';
import { BookOrderList } from './BookOrderList';

interface Props {
  form: PlanFormState;
  onChange: (update: (prev: PlanFormState) => PlanFormState) => void;
  bible: BibleData;
  preview?: { verses: number; days: number; average: number | null };
  onPreview?: () => void;
}

const SCOPES: ScopeKind[] = ['all', 'ot', 'nt', 'books'];
const DURATION_PRESETS = [30, 90, 180, 365] as const;
type DurationPreset = (typeof DURATION_PRESETS)[number] | 'custom';
type ReadingPreset = 'daily' | 'six' | 'five' | 'custom';
type QuickStep = 0 | 1 | 2 | 3;
const CADENCES: Record<Exclude<ReadingPreset, 'custom'>, Weekday[]> = {
  daily: [...ALL_WEEKDAYS],
  six: [1, 2, 3, 4, 5, 6],
  five: [1, 2, 3, 4, 5],
};

function presetForPeriod(start: string, end: string): DurationPreset {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return 'custom';
  const days = Math.round((endTime - startTime) / 86_400_000) + 1;
  return DURATION_PRESETS.find((preset) => preset === days) ?? 'custom';
}

function presetForWeekdays(days: Weekday[]): ReadingPreset {
  return (Object.entries(CADENCES).find(([, presetDays]) => presetDays.join(',') === [...days].sort().join(','))?.[0] as ReadingPreset | undefined) ?? 'custom';
}

/** 계획 입력 폼. 값은 언어와 무관한 형태로 부모가 들고 있고, 이 컴포넌트는 표시만 한다(AC18). */
export function PlanForm({ form, onChange, bible, preview, onPreview }: Props) {
  const { lang, t } = useI18n();
  const idBase = useId();
  const [excludeDraft, setExcludeDraft] = useState('');
  const [durationPreset, setDurationPreset] = useState<DurationPreset>(() => presetForPeriod(form.startDate, form.endDate));
  const [readingPreset, setReadingPreset] = useState<ReadingPreset>(() => presetForWeekdays(form.weekdays));
  const [activeStep, setActiveStep] = useState<QuickStep>(0);
  const books = listBooks(bible);
  const bookIds = books.map((b) => b.bookId);
  const patch = (p: Partial<PlanFormState>) => onChange((f) => ({ ...f, ...p }));
  const goToStep = (step: QuickStep) => {
    setActiveStep(step);
  };

  const toggleWeekday = (w: Weekday) =>
    patch({
      weekdays: form.weekdays.includes(w) ? form.weekdays.filter((x) => x !== w) : [...form.weekdays, w].sort(),
    });

  const addExcluded = () => {
    const d = excludeDraft.trim();
    if (d === '' || form.excludedDates.includes(d)) return;
    patch({ excludedDates: [...form.excludedDates, d].sort() });
    setExcludeDraft('');
  };

  const selectDuration = (preset: DurationPreset) => {
    setDurationPreset(preset);
    if (preset !== 'custom') patch({ endDate: addDays(form.startDate, preset - 1) });
    if (preset !== 'custom') goToStep(2);
  };

  const selectReadingDays = (preset: ReadingPreset) => {
    setReadingPreset(preset);
    if (preset !== 'custom') patch({ weekdays: [...CADENCES[preset]] });
  };

  return (
    <form className="plan-form" onSubmit={(e) => e.preventDefault()} aria-label={t('plan.heading')}>
      <div className="plan-form__steps-nav" role="group" aria-label={t('plan.quick.steps')}>
        {(['plan.quick.scope', 'plan.quick.period', 'plan.quick.readingDays', 'plan.quick.advanced'] as MessageKey[]).map((key, index) => (
          <button
            key={key}
            type="button"
            className="plan-form__step-link"
            aria-pressed={activeStep === index}
            onClick={() => goToStep(index as QuickStep)}
          >
            <span className="plan-form__step-number" aria-hidden="true">{index === 3 ? '⋯' : index + 1}</span>
            <span>{t(key)}</span>
          </button>
        ))}
      </div>
      <div className="plan-form__panel" aria-live="polite">
      {activeStep === 0 && <>
      <fieldset className="plan-quick-fieldset">
        <legend>{t('plan.quick.scope')}</legend>
        <div className="choice-row">
          {SCOPES.map((s) => (
            <label key={s} className="choice">
              <input type="radio" name={`${idBase}-scope`} checked={form.scopeKind === s} onChange={() => { patch({ scopeKind: s }); if (s !== 'books') goToStep(1); }} />
              <span>{t(`plan.scope.${s}` as MessageKey)}</span>
            </label>
          ))}
        </div>
      {form.scopeKind === 'books' && (
          <div className="books-picker">
            <fieldset>
              <legend>{t('plan.books.selectLegend')}</legend>
              <div className="choice-row">
                {bookIds.map((id) => (
                  <label key={id} className="choice">
                    <input
                      type="checkbox"
                      checked={form.bookIds.includes(id)}
                      onChange={(e) => patch({ bookIds: e.target.checked ? [...form.bookIds, id] : form.bookIds.filter((b) => b !== id) })}
                    />
                    <span>{bookName(id, lang)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div role="group" aria-label={t('plan.books.orderLegend')}>
              <p className="field-title">{t('plan.books.orderLegend')}</p>
              <BookOrderList
                bookIds={form.bookIds}
                onReorder={(bookIds) => patch({ bookIds })}
                onRemove={(bookId) => patch({ bookIds: form.bookIds.filter((id) => id !== bookId) })}
              />
            </div>
          </div>
        )}
        {form.scopeKind === 'books' && (
          <button type="button" className="btn btn--small plan-form__next" disabled={form.bookIds.length === 0} onClick={() => goToStep(1)}>
            {t('plan.quick.next')}
          </button>
      )}
      </fieldset>
      </>}

      {activeStep === 1 && <>
      <fieldset className="plan-quick-fieldset">
        <legend>{t('plan.quick.period')}</legend>
        <div className="plan-preset-row" role="group" aria-label={t('plan.quick.period')}>
          {DURATION_PRESETS.map((days) => (
            <button key={days} type="button" className="plan-preset" aria-pressed={durationPreset === days} onClick={() => selectDuration(days)}>
              {t(`plan.quick.duration.${days}` as MessageKey)}
            </button>
          ))}
          <button type="button" className="plan-preset" aria-pressed={durationPreset === 'custom'} onClick={() => selectDuration('custom')}>
            {t('plan.quick.customDates')}
          </button>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('plan.startDate')}</span>
            <input type="date" value={form.startDate} onChange={(e) => patch({
              startDate: e.target.value,
              ...(durationPreset !== 'custom' && e.target.value ? { endDate: addDays(e.target.value, durationPreset - 1) } : {}),
            })} />
          </label>
          {durationPreset === 'custom' && <label className="field">
            <span>{t('plan.endDate')}</span>
            <input type="date" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
          </label>}
        </div>
        <p className="qt-note">{t('plan.periodHint')}</p>
        <button type="button" className="btn btn--small plan-form__next" onClick={() => goToStep(2)}>{t('plan.quick.next')}</button>
      </fieldset>
      </>}

      {activeStep === 2 && <>
      <fieldset className="plan-quick-fieldset">
        <legend>{t('plan.quick.readingDays')}</legend>
        <div className="plan-preset-row" role="group" aria-label={t('plan.quick.readingDays')}>
          {(['daily', 'six', 'five', 'custom'] as ReadingPreset[]).map((preset) => (
            <button key={preset} type="button" className="plan-preset" aria-pressed={readingPreset === preset} onClick={() => selectReadingDays(preset)}>
              {t(`plan.quick.cadence.${preset}` as MessageKey)}
            </button>
          ))}
        </div>
        {readingPreset === 'custom' && <div className="choice-row" role="group" aria-label={t('plan.weekdays.legend')}>
          {ALL_WEEKDAYS.map((w) => (
            <label key={w} className="choice">
              <input type="checkbox" checked={form.weekdays.includes(w)} onChange={() => { setReadingPreset('custom'); toggleWeekday(w); }} />
              <span>{t(`export.weekday.${w}` as MessageKey)}</span>
            </label>
          ))}
        </div>}
        {readingPreset === 'custom' && <button type="button" className="btn btn--small plan-form__next" onClick={onPreview}>{t('plan.quick.toResult')}</button>}
      </fieldset>
      </>}

      {activeStep === 3 && <div className="plan-advanced">
        <h3>{t('plan.quick.advanced')}</h3>
        <div className="plan-advanced__body">
        <fieldset>
        <legend>{t('plan.excluded.legend')}</legend>
        <div className="field-row">
          <label className="field">
            <span>{t('plan.excluded.date')}</span>
            <input type="date" value={excludeDraft} onChange={(e) => setExcludeDraft(e.target.value)} />
          </label>
          <button type="button" className="btn btn--small" onClick={addExcluded} disabled={excludeDraft === ''}>
            {t('plan.excluded.add')}
          </button>
        </div>
        {form.excludedDates.length === 0 ? (
          <p className="qt-note">{t('plan.excluded.none')}</p>
        ) : (
          <ul className="chip-list">
            {form.excludedDates.map((d) => (
              <li key={d}>
                <span>{d}</span>
                <button type="button" className="btn btn--small" onClick={() => patch({ excludedDates: form.excludedDates.filter((x) => x !== d) })}>
                  {t('plan.excluded.remove', { date: d })}
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('plan.distribution.legend')}</legend>
        {(['verses', 'chapters'] as Distribution[]).map((d) => (
          <label key={d} className="choice">
            <input type="radio" name={`${idBase}-dist`} checked={form.distribution === d} onChange={() => patch({ distribution: d })} />
            <span>{t(`plan.distribution.${d}` as MessageKey)}</span>
          </label>
        ))}
        <p className="qt-note">{t(form.distribution === 'verses' ? 'plan.distribution.versesHint' : 'plan.distribution.chaptersHint')}</p>
      </fieldset>

      <label className="field">
        <span>{t('plan.name.label')}</span>
        <input type="text" value={form.planName} maxLength={60} onChange={(e) => patch({ planName: e.target.value })} />
      </label>
        </div>
      </div>}
      </div>
      {preview && <p className="plan-quick-summary" role="status">
        {t('plan.quick.summary', { verses: preview.verses, days: preview.days, average: preview.average === null ? '—' : preview.average.toFixed(1) })}
      </p>}
      <button type="button" className="btn plan-preview-button" onClick={onPreview}>{t('plan.quick.preview')}</button>
    </form>
  );
}
