import { useI18n } from '@/i18n';
import type { ExportModel } from '@/export/planExport';

/** 화면에서는 숨기고 인쇄할 때만 보이는 계획표. 목록·Excel·PDF와 같은 ExportModel을 쓴다. */
export function PlanPrintSheet({ model }: { model: ExportModel }) {
  const { t } = useI18n();
  const { meta, rows } = model;
  return (
    <div className="print-sheet" aria-hidden="true">
      <h2>{meta.planName}</h2>
      <p>
        {meta.startDate} ~ {meta.endDate} · {meta.basisLabel} · {meta.recalculatedLabel}
      </p>
      <p>
        {meta.versificationSystem} / {meta.dataVersion} · {meta.generatedOn}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t('export.col.check')}</th>
            <th>{t('export.col.date')}</th>
            <th>{t('export.col.range')}</th>
            <th>{t('export.col.verses')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date}>
              <td className="print-sheet__check">{r.status === 'assigned' ? '☐' : ''}</td>
              <td>
                {r.date} ({r.weekdayLabel})
              </td>
              <td>
                {r.displayText}
                {r.partialText && ` (${t('export.col.partial')}: ${r.partialText})`}
              </td>
              <td>{r.status === 'assigned' ? r.verseCount : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{t('export.pdf.note')}</p>
    </div>
  );
}
