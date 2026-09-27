import { useMemo, useState } from 'react';
import { addDays, weekdayOf, type Weekday } from '@/domain';
import { useI18n, type MessageKey } from '@/i18n';
import type { ExportRow } from '@/export/planExport';

interface Props {
  rows: ExportRow[];
  today: string;
  weekStart: Weekday;
  onWeekStartChange: (w: Weekday) => void;
  chapterOnly?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function shiftMonth(ym: string, delta: number): string {
  const [y = 0, m = 1] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** 월간 캘린더. 목록과 같은 ExportRow를 쓰며, 날짜를 고르면 배정 범위를 아래에 보여 준다(CAL01). */
export function PlanCalendar({ rows, today, weekStart, onWeekStartChange, chapterOnly = false }: Props) {
  const { lang, t } = useI18n();
  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r])), [rows]);
  const first = rows[0]?.date ?? today;
  const last = rows[rows.length - 1]?.date ?? today;
  const defaultMonth = today >= first && today <= last ? today.slice(0, 7) : first.slice(0, 7);
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const ym = month ?? defaultMonth;

  const [y = 0, m = 1] = ym.split('-').map(Number);
  const lead = (weekdayOf(`${ym}-01`) - weekStart + 7) % 7;
  const firstCell = addDays(`${ym}-01`, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(firstCell, i));
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthLabel = new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));

  const selectedRow = selected ? byDate.get(selected) : undefined;
  const headers = Array.from({ length: 7 }, (_, i) => ((weekStart + i) % 7) as Weekday);

  return (
    <div className="calendar">
      <div className="calendar__nav">
        <button type="button" className="btn btn--small" onClick={() => setMonth(shiftMonth(ym, -1))}>
          {t('plan.cal.prev')}
        </button>
        <h4 className="calendar__title" aria-live="polite">
          {monthLabel}
        </h4>
        <button type="button" className="btn btn--small" onClick={() => setMonth(shiftMonth(ym, 1))}>
          {t('plan.cal.next')}
        </button>
      </div>

      <table className="calendar__grid">
        <caption className="visually-hidden">{t('plan.cal.caption', { month: monthLabel })}</caption>
        <thead>
          <tr>
            {headers.map((w) => (
              <th key={w} scope="col">
                {t(`export.weekday.${w}` as MessageKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                const row = byDate.get(date);
                const dayNum = Number(date.slice(8));
                const outsideMonth = !date.startsWith(ym);
                const displayedDay = outsideMonth && dayNum === 1 ? `${Number(date.slice(5, 7))}/1` : dayNum;
                if (!row) {
                  return (
                    <td key={di} className="cal-cell cal-cell--outside" title={t('plan.cal.outside')}>
                      <span className="cal-cell__num">{displayedDay}</span>
                    </td>
                  );
                }
                const label = t('plan.cal.cellLabel', { date, weekday: row.weekdayLabel, text: row.displayText });
                return (
                  <td key={di} className={`cal-cell cal-cell--${row.status}${outsideMonth ? ' cal-cell--outside-month' : ''}`}>
                    <button
                      type="button"
                      className="cal-cell__btn"
                      aria-label={label}
                      aria-pressed={selected === date}
                      {...(date === today ? { 'aria-current': 'date' as const } : {})}
                      onClick={() => setSelected(date)}
                    >
                      <span className="cal-cell__num">{displayedDay}</span>
                      <span className="cal-cell__text" aria-hidden="true">
                        {row.displayText}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="calendar__settings">
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            setMonth(today.slice(0, 7));
            setSelected(byDate.has(today) ? today : null);
          }}
        >
          {t('plan.cal.today')}
        </button>
        <label className="field field--inline">
          <span>{t('plan.cal.weekStart')}</span>
          <select value={weekStart} onChange={(e) => onWeekStartChange(Number(e.target.value) as Weekday)}>
            <option value={0}>{t('plan.cal.sunday')}</option>
            <option value={1}>{t('plan.cal.monday')}</option>
          </select>
        </label>
      </div>

      <div className="calendar__detail" aria-live="polite">
        <h4>{t('plan.cal.selected')}</h4>
        {selectedRow ? (
          <p>
            <time dateTime={selectedRow.date}>{selectedRow.date}</time> ({selectedRow.weekdayLabel}) {selectedRow.displayText}
            {selectedRow.status === 'assigned' &&
              ` · ${chapterOnly ? '' : `${t('plan.day.verses', { n: selectedRow.verseCount })} · `}${t('plan.day.chapters', { n: selectedRow.chapterCount })}`}
            {selectedRow.partialText && ` · ${t('plan.day.partial', { chapters: selectedRow.partialText })}`}
          </p>
        ) : (
          <p className="qt-note">{t('plan.cal.noSelection')}</p>
        )}
      </div>
    </div>
  );
}
