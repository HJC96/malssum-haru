import type { Weekday } from '@/domain';
import type { ExportRow } from '@/export/planExport';
import { useI18n } from '@/i18n';
import { PlanCalendar } from './PlanCalendar';
import { PlanDayList } from './PlanDayList';

interface Props {
  rows: ExportRow[];
  today: string;
  view: 'list' | 'calendar';
  weekStart: Weekday;
  onWeekStartChange: (w: Weekday) => void;
  chapterOnly?: boolean;
}

/** Keep both views mounted so each view's scroll/month/selection survives a view switch. */
export function PlanScheduleView({ rows, today, view, weekStart, onWeekStartChange, chapterOnly = false }: Props) {
  const { t } = useI18n();
  return (
    <div className={`plan-view-frame${view === 'calendar' ? ' plan-view-frame--calendar' : ''}`}>
      <div className="plan-view-frame__scroll" role="region" aria-label={t('plan.schedule.listLabel')} tabIndex={0} hidden={view !== 'list'}>
        <PlanDayList rows={rows} chapterOnly={chapterOnly} />
      </div>
      <div className="plan-view-frame__scroll" role="region" aria-label={t('plan.schedule.calendarLabel')} tabIndex={0} hidden={view !== 'calendar'}>
        <PlanCalendar rows={rows} today={today} weekStart={weekStart} onWeekStartChange={onWeekStartChange} chapterOnly={chapterOnly} />
      </div>
    </div>
  );
}
