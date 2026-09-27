import { useId, useState, type SyntheticEvent } from 'react';
import { listBooks, type BibleData } from '@/domain';
import { bookName, useI18n, type MessageKey } from '@/i18n';
import type { PlanFormState, ReadMode } from '@/app/plan/planForm';
import { RangeRows } from './RangeRows';

export type ProgressFields = Pick<PlanFormState, 'readMode' | 'through' | 'readRanges' | 'todayRead'>;
const READ_MODES: ReadMode[] = ['none', 'continuous', 'ranges'];
const fieldsFrom = (form: PlanFormState): ProgressFields => ({
  readMode: form.readMode,
  through: { ...form.through },
  readRanges: form.readRanges.map((r) => ({ ...r })),
  todayRead: form.todayRead.map((r) => ({ ...r })),
});

interface Props {
  form: PlanFormState;
  bible: BibleData;
  onApply: (fields: ProgressFields) => boolean;
}

/** Progress entry is collapsed below the progress summary and commits only when the user applies it. */
export function ProgressEditor({ form, bible, onApply }: Props) {
  const { lang, t } = useI18n();
  const idBase = useId();
  const [draft, setDraft] = useState(() => fieldsFrom(form));
  const [open, setOpen] = useState(false);
  const books = listBooks(bible).map((book) => book.bookId);
  const chapterOnly = bible.versificationSystem === 'chapter-only-66';
  const patch = (p: Partial<ProgressFields>) => setDraft((prev) => ({ ...prev, ...p }));
  const toggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    if (nextOpen) setDraft(fieldsFrom(form));
    setOpen(nextOpen);
  };

  return (
    <details className="progress-editor" open={open} onToggle={toggle}>
      <summary>{t(form.readMode === 'none' ? 'plan.progressEditor.open' : 'plan.progressEditor.edit')}</summary>
      <p className="qt-note">{t('plan.progressEditor.storage')}</p>
      <fieldset>
        <legend>{t('plan.read.legend')}</legend>
        {READ_MODES.map((mode) => (
          <label key={mode} className="choice">
            <input type="radio" name={`${idBase}-read`} checked={draft.readMode === mode} onChange={() => patch({ readMode: mode })} />
            <span>{t(`plan.read.${mode}` as MessageKey)}</span>
          </label>
        ))}
        {draft.readMode === 'continuous' && (
          <div className="range-row" role="group" aria-label={t('plan.read.through')}>
            <label className="field"><span>{t('plan.range.book')}</span><select value={draft.through.bookId} onChange={(e) => patch({ through: { ...draft.through, bookId: e.target.value } })}><option value="" />{books.map((id) => <option key={id} value={id}>{bookName(id, lang)}</option>)}</select></label>
            <label className="field field--num"><span>{t('plan.range.chapter')}</span><input type="text" inputMode="numeric" autoComplete="off" value={draft.through.chapter} onChange={(e) => patch({ through: { ...draft.through, chapter: e.target.value } })} /></label>
            {!chapterOnly && <label className="field field--num"><span>{t('plan.range.verse')}</span><input type="text" inputMode="numeric" autoComplete="off" value={draft.through.verse} onChange={(e) => patch({ through: { ...draft.through, verse: e.target.value } })} /></label>}
          </div>
        )}
        {draft.readMode === 'ranges' && <><RangeRows rows={draft.readRanges} bookIds={books} onChange={(readRanges) => patch({ readRanges })} chapterOnly={chapterOnly} /><p className="qt-note">{t('plan.read.rangesHint')}</p></>}
      </fieldset>
      <fieldset>
        <legend>{t('plan.todayRead.legend')}</legend>
        <RangeRows rows={draft.todayRead} bookIds={books} onChange={(todayRead) => patch({ todayRead })} allowEmpty chapterOnly={chapterOnly} />
        <p className="qt-note">{t('plan.todayRead.hint')}</p>
      </fieldset>
      <div className="choice-row">
        <button type="button" className="btn" onClick={() => { if (onApply(draft)) setOpen(false); }}>{t('plan.progressEditor.apply')}</button>
        <button type="button" className="btn btn--small" onClick={() => { setDraft(fieldsFrom(form)); setOpen(false); }}>{t('plan.progressEditor.cancel')}</button>
      </div>
    </details>
  );
}
