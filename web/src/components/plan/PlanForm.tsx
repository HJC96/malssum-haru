import { useId, useState } from 'react';
import { listBooks, type BibleData, type Distribution, type Weekday } from '@/domain';
import { bookName, useI18n, type MessageKey } from '@/i18n';
import { ALL_WEEKDAYS, type PlanFormState, type ReadMode, type ScopeKind } from '@/app/plan/planForm';
import { RangeRows } from './RangeRows';

interface Props {
  form: PlanFormState;
  onChange: (update: (prev: PlanFormState) => PlanFormState) => void;
  bible: BibleData;
  today: string;
}

const SCOPES: ScopeKind[] = ['all', 'ot', 'nt', 'books'];
const READ_MODES: ReadMode[] = ['none', 'continuous', 'ranges'];

/** 계획 입력 폼. 값은 언어와 무관한 형태로 부모가 들고 있고, 이 컴포넌트는 표시만 한다(AC18). */
export function PlanForm({ form, onChange, bible, today }: Props) {
  const { lang, t } = useI18n();
  const idBase = useId();
  const [excludeDraft, setExcludeDraft] = useState('');
  const books = listBooks(bible);
  const bookIds = books.map((b) => b.bookId);
  const patch = (p: Partial<PlanFormState>) => onChange((f) => ({ ...f, ...p }));

  const toggleWeekday = (w: Weekday) =>
    patch({
      weekdays: form.weekdays.includes(w) ? form.weekdays.filter((x) => x !== w) : [...form.weekdays, w].sort(),
    });

  const move = (i: number, delta: -1 | 1) => {
    const next = [...form.bookIds];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j] as string, next[i] as string];
    patch({ bookIds: next });
  };

  const addExcluded = () => {
    const d = excludeDraft.trim();
    if (d === '' || form.excludedDates.includes(d)) return;
    patch({ excludedDates: [...form.excludedDates, d].sort() });
    setExcludeDraft('');
  };

  return (
    <form className="plan-form" onSubmit={(e) => e.preventDefault()} aria-label={t('plan.heading')}>
      <fieldset>
        <legend>{t('plan.scope.legend')}</legend>
        <div className="choice-row">
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
              {form.bookIds.length === 0 ? (
                <p className="qt-note">{t('plan.books.none')}</p>
              ) : (
                <ol className="order-list">
                  {form.bookIds.map((id, i) => (
                    <li key={id}>
                      <span>{bookName(id, lang)}</span>
                      <button type="button" className="btn btn--small" disabled={i === 0} onClick={() => move(i, -1)}>
                        {t('plan.books.up', { book: bookName(id, lang) })}
                      </button>
                      <button type="button" className="btn btn--small" disabled={i === form.bookIds.length - 1} onClick={() => move(i, 1)}>
                        {t('plan.books.down', { book: bookName(id, lang) })}
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => patch({ bookIds: form.bookIds.filter((b) => b !== id) })}>
                        {t('plan.books.remove', { book: bookName(id, lang) })}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('plan.period.legend')}</legend>
        <div className="field-row">
          <label className="field">
            <span>{t('plan.startDate')}</span>
            <input type="date" value={form.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('plan.endDate')}</span>
            <input type="date" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
          </label>
        </div>
        <p className="qt-note">{t('plan.periodHint')}</p>
      </fieldset>

      <fieldset>
        <legend>{t('plan.weekdays.legend')}</legend>
        <div className="choice-row">
          {ALL_WEEKDAYS.map((w) => (
            <label key={w} className="choice">
              <input type="checkbox" checked={form.weekdays.includes(w)} onChange={() => toggleWeekday(w)} />
              <span>{t(`export.weekday.${w}` as MessageKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>

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

      <fieldset>
        <legend>{t('plan.read.legend')}</legend>
        {READ_MODES.map((m) => (
          <label key={m} className="choice">
            <input type="radio" name={`${idBase}-read`} checked={form.readMode === m} onChange={() => patch({ readMode: m })} />
            <span>{t(`plan.read.${m}` as MessageKey)}</span>
          </label>
        ))}
        {form.readMode === 'continuous' && (
          <div className="range-row" role="group" aria-label={t('plan.read.through')}>
            <label className="field">
              <span>{t('plan.range.book')}</span>
              <select value={form.through.bookId} onChange={(e) => patch({ through: { ...form.through, bookId: e.target.value } })}>
                <option value="" />
                {bookIds.map((id) => (
                  <option key={id} value={id}>
                    {bookName(id, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--num">
              <span>{t('plan.range.chapter')}</span>
              <input type="text" inputMode="numeric" autoComplete="off" value={form.through.chapter} onChange={(e) => patch({ through: { ...form.through, chapter: e.target.value } })} />
            </label>
            <label className="field field--num">
              <span>{t('plan.range.verse')}</span>
              <input type="text" inputMode="numeric" autoComplete="off" value={form.through.verse} onChange={(e) => patch({ through: { ...form.through, verse: e.target.value } })} />
            </label>
          </div>
        )}
        {form.readMode === 'ranges' && (
          <>
            <RangeRows rows={form.readRanges} bookIds={bookIds} onChange={(readRanges) => patch({ readRanges })} />
            <p className="qt-note">{t('plan.read.rangesHint')}</p>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('plan.todayRead.legend')}</legend>
        <RangeRows rows={form.todayRead} bookIds={bookIds} onChange={(todayRead) => patch({ todayRead })} allowEmpty />
        <p className="qt-note">{t('plan.todayRead.hint')}</p>
      </fieldset>

      <div className="form-block">
        <label className="choice">
          <input type="checkbox" checked={form.recalc} onChange={(e) => patch({ recalc: e.target.checked })} />
          <span>{t('plan.recalc.label', { date: today })}</span>
        </label>
        <p className="qt-note">{t('plan.recalc.hint')}</p>
      </div>

      <label className="field">
        <span>{t('plan.name.label')}</span>
        <input type="text" value={form.planName} maxLength={60} onChange={(e) => patch({ planName: e.target.value })} />
      </label>
    </form>
  );
}
