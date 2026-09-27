import { useI18n } from '@/i18n';
import type { ExportRow } from '@/export/planExport';

/**
 * 날짜별 목록. 캘린더·Excel·PDF와 같은 ExportRow를 쓴다(AC10, AC17).
 * 쉬는 날·빈 날·재계산 이전 날짜는 완료나 미완료로 표시하지 않고 상태만 알린다.
 */
export function PlanDayList({ rows, chapterOnly = false }: { rows: ExportRow[]; chapterOnly?: boolean }) {
  const { t } = useI18n();
  return (
    <table className="day-list">
      <caption className="visually-hidden">{t('plan.list.caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('plan.list.date')}</th>
          <th scope="col">{t('plan.list.weekday')}</th>
          <th scope="col">{t('plan.list.range')}</th>
          {!chapterOnly && <th scope="col">{t('plan.list.verses')}</th>}
          <th scope="col">{t('plan.list.chapters')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date} className={`day-row day-row--${r.status}`} data-date={r.date}>
            <th scope="row" className="day-row__date">
              <time dateTime={r.date}>{r.date}</time>
            </th>
            <td className="day-row__weekday">{r.weekdayLabel}</td>
            <td className="day-row__range">
              {r.displayText}
              {r.partialText && <span className="day-row__partial"> ({t('plan.day.partial', { chapters: r.partialText })})</span>}
            </td>
            {!chapterOnly && <td className="day-row__num">{r.status === 'assigned' ? t('plan.day.verses', { n: r.verseCount }) : ''}</td>}
            <td className="day-row__num">{r.status === 'assigned' ? t('plan.day.chapters', { n: r.chapterCount }) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
