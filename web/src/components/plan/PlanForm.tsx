import { useId, useState } from 'react';
import { addDays, listBooks, type BibleData, type Distribution, type Weekday } from '@/domain';
import { bookName, useI18n, type MessageKey } from '@/i18n';
import { ALL_WEEKDAYS, type PlanFormState, type ScopeKind } from '@/app/plan/planForm';
import { BookOrderList } from './BookOrderList';

interface Props {
  form: PlanFormState;
  onChange: (update: (prev: PlanFormState) => PlanFormState) => void;
  bible: BibleData;
  preview?: { units: number; days: number; average: number | null; chapterOnly: boolean };
  onPreview?: () => void;
  onDistributionChange?: (distribution: Distribution) => void;
}

const SCOPES: ScopeKind[] = ['all', 'ot', 'nt', 'books'];
const DURATION_PRESETS = [30, 90, 180, 365] as const;
type DurationPreset = (typeof DURATION_PRESETS)[number] | 'custom';
type ReadingPreset = 'daily' | 'six' | 'five' | 'custom';
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
export function PlanForm({ form, onChange, bible, preview, onPreview, onDistributionChange }: Props) {
  const { lang, t } = useI18n();
  const idBase = useId();
  const [excludeDraft, setExcludeDraft] = useState('');
  const [durationPreset, setDurationPreset] = useState<DurationPreset>(() => presetForPeriod(form.startDate, form.endDate));
  const [readingPreset, setReadingPreset] = useState<ReadingPreset>(() => presetForWeekdays(form.weekdays));
  const books = listBooks(bible);
  const bookIds = books.map((b) => b.bookId);
  const patch = (p: Partial<PlanFormState>) => onChange((f) => ({ ...f, ...p }));

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
  };

  const selectReadingDays = (preset: ReadingPreset) => {
    setReadingPreset(preset);
    if (preset !== 'custom') patch({ weekdays: [...CADENCES[preset]] });
  };

  return (
    <form className="plan-form" onSubmit={(e) => e.preventDefault()} aria-label={t('plan.heading')}>
      <div className="plan-form__panel">
      <fieldset className="plan-quick-fieldset plan-quick-fieldset--scope">
        <legend><span className="plan-step-index" aria-hidden="true">1</span>{t('plan.quick.scope')}</legend>
        <div className="choice-row plan-scope-options">
          {SCOPES.map((s) => (
            <label key={s} className="choice">
              <input type="radio" name={`${idBase}-scope`} checked={form.scopeKind === s} onChange={() => patch({ scopeKind: s })} />
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
      </fieldset>

      <fieldset className="plan-quick-fieldset plan-quick-fieldset--period">
        <legend><span className="plan-step-index" aria-hidden="true">2</span>{t('plan.quick.period')}</legend>
        <label className="field">
          <span>{t('plan.endDate')}</span>
          <input type="date" value={form.endDate} onChange={(e) => { setDurationPreset('custom'); patch({ endDate: e.target.value }); }} />
        </label>
        <details className="plan-form__extra">
          <summary>{t('plan.quick.periodMore')}</summary>
          <label className="field">
            <span>{t('plan.startDate')}</span>
            <input type="date" value={form.startDate} onChange={(e) => patch({
              startDate: e.target.value,
              ...(durationPreset !== 'custom' && e.target.value ? { endDate: addDays(e.target.value, durationPreset - 1) } : {}),
            })} />
          </label>
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
        </details>
      </fieldset>

      <fieldset className="plan-quick-fieldset plan-quick-fieldset--weekdays">
        <legend><span className="plan-step-index" aria-hidden="true">3</span>{t('plan.quick.readingDays')}</legend>
        <div className="choice-row plan-weekdays" role="group" aria-label={t('plan.weekdays.legend')}>
          {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((w) => (
            <label key={w} className="choice">
              <input type="checkbox" checked={form.weekdays.includes(w)} onChange={() => { setReadingPreset('custom'); toggleWeekday(w); }} />
              <span>{t(`export.weekday.${w}` as MessageKey)}</span>
            </label>
          ))}
        </div>
        <details className="plan-form__extra">
          <summary>{t('plan.quick.cadenceMore')}</summary>
          <div className="plan-preset-row" role="group" aria-label={t('plan.quick.readingDays')}>
            {(['daily', 'six', 'five', 'custom'] as ReadingPreset[]).map((preset) => (
              <button key={preset} type="button" className="plan-preset" aria-pressed={readingPreset === preset} onClick={() => selectReadingDays(preset)}>
                {t(`plan.quick.cadence.${preset}` as MessageKey)}
              </button>
            ))}
          </div>
        </details>
      </fieldset>

      <fieldset className="plan-distribution">
        <legend><span className="plan-step-index" aria-hidden="true">4</span>{t('plan.quick.advanced')}</legend>
        <div className="plan-distribution__options">
          <label className="choice">
            <input type="radio" name={`${idBase}-dist`} checked={form.distribution === 'chapters'} onChange={() => onDistributionChange ? onDistributionChange('chapters') : patch({ distribution: 'chapters' })} />
            <span>{t('plan.distribution.chapters')}</span>
          </label>
          <div className="plan-distribution__verse">
            <label className="choice">
              <input type="radio" name={`${idBase}-dist`} checked={form.distribution === 'verses'} aria-describedby={`${idBase}-verse-limit`} onChange={() => onDistributionChange ? onDistributionChange('verses') : patch({ distribution: 'verses' })} />
              <span>{t('plan.distribution.verses')}</span>
            </label>
            <details className="plan-distribution__info">
              <summary aria-label={t('plan.distribution.infoLabel')}>ⓘ</summary>
              <p id={`${idBase}-verse-limit`} className="plan-distribution__tooltip">{t('plan.distribution.verseLimit')}</p>
            </details>
          </div>
        </div>
        <p className="qt-note">{t(form.distribution === 'verses' ? 'plan.distribution.versesHint' : 'plan.distribution.chaptersHint')}</p>
      </fieldset>

      <details className="plan-advanced">
        <summary>{t('plan.moreSettings')}</summary>
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

      <label className="field">
        <span>{t('plan.name.label')}</span>
        <input type="text" value={form.planName} maxLength={60} onChange={(e) => patch({ planName: e.target.value })} />
      </label>
        </div>
      </details>
      </div>
      {preview && <p className="plan-quick-summary" role="status">
        {t(preview.chapterOnly ? 'plan.quick.chapterSummary' : 'plan.quick.summary', { verses: preview.units, days: preview.days, average: preview.average === null ? '—' : preview.average.toFixed(1) })}
      </p>}
      <button type="button" className="btn plan-preview-button" onClick={onPreview}>{t('plan.quick.preview')}</button>
    </form>
  );
}
