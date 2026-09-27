import { bookName, useI18n } from '@/i18n';
import { emptyRange, type RangeDraft } from '@/app/plan/planForm';

interface Props {
  rows: RangeDraft[];
  bookIds: string[];
  onChange: (rows: RangeDraft[]) => void;
  /** 행이 하나도 없어도 되는지(오늘 읽은 범위는 선택 입력). */
  allowEmpty?: boolean;
  chapterOnly?: boolean;
}

/** 개별 장절 범위 입력 행들. 겹치는 범위는 계산 쪽에서 합집합으로 한 번만 센다. */
export function RangeRows({ rows, bookIds, onChange, allowEmpty = false, chapterOnly = false }: Props) {
  const { lang, t } = useI18n();
  const update = (i: number, patch: Partial<RangeDraft>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="range-rows">
      {rows.map((row, i) => {
        const n = i + 1;
        return (
          <div key={i} className="range-row" role="group" aria-label={t('plan.range.row', { n })}>
            <label className="field">
              <span>{t('plan.range.book')}</span>
              <select value={row.bookId} onChange={(e) => update(i, { bookId: e.target.value })}>
                <option value="" />
                {bookIds.map((id) => (
                  <option key={id} value={id}>
                    {bookName(id, lang)}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ['startChapter', 'plan.range.startChapter'],
                ['startVerse', 'plan.range.startVerse'],
                ['endChapter', 'plan.range.endChapter'],
                ['endVerse', 'plan.range.endVerse'],
              ] as const
            ).filter(([field]) => !chapterOnly || field === 'startChapter' || field === 'endChapter').map(([field, labelKey]) => (
              <label key={field} className="field field--num">
                <span>{t(labelKey)}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={row[field]}
                  onChange={(e) => update(i, { [field]: e.target.value })}
                />
              </label>
            ))}
            {(rows.length > 1 || allowEmpty) && (
              <button type="button" className="btn btn--small" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
                {t('plan.range.remove', { n })}
              </button>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn--small" onClick={() => onChange([...rows, emptyRange()])}>
        {t('plan.range.add')}
      </button>
    </div>
  );
}
