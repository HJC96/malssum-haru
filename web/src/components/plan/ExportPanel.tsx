import { useState } from 'react';
import type { Weekday } from '@/domain';
import { useI18n } from '@/i18n';
import { downloadBlob } from '@/export/download';
import { exportFileName, monthsOf, rowsForMonth, type ExportModel } from '@/export/planExport';

interface Props {
  model: ExportModel;
  weekStart: Weekday;
  /** 테스트에서 실제 다운로드를 대체한다. */
  onFile?: (blob: Blob, fileName: string) => void;
}

type Phase = { kind: 'idle' } | { kind: 'working' } | { kind: 'done'; file: string } | { kind: 'failed' };

/**
 * Excel·PDF·인쇄. 파일은 화면과 같은 ExportModel로 브라우저 안에서 만들고 서버로 보내지 않는다.
 * 생성 라이브러리(exceljs, pdf-lib)와 한글 폰트는 버튼을 누를 때만 내려받는다.
 */
export function ExportPanel({ model, weekStart, onFile = downloadBlob }: Props) {
  const { t } = useI18n();
  const [month, setMonth] = useState<string>('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const months = monthsOf(model);
  const monthSel = months.includes(month) ? month : null;

  const run = async (kind: 'xlsx' | 'pdf-list' | 'pdf-month') => {
    setPhase({ kind: 'working' });
    try {
      if (kind === 'xlsx') {
        const { buildXlsx, xlsxBlob } = await import('@/export/xlsx');
        const bytes = await buildXlsx(model, rowsForMonth(model, monthSel));
        const file = exportFileName(model, 'xlsx', monthSel);
        onFile(xlsxBlob(bytes), file);
        setPhase({ kind: 'done', file });
      } else {
        const { buildPdf, pdfBlob } = await import('@/export/pdf');
        const bytes = await buildPdf(model, { kind: kind === 'pdf-list' ? 'list' : 'month', month: monthSel, weekStart });
        const file = exportFileName(model, 'pdf', monthSel, kind === 'pdf-month' ? '-month' : '-list');
        onFile(pdfBlob(bytes), file);
        setPhase({ kind: 'done', file });
      }
    } catch {
      // 오류 내용(계획이 담길 수 있음)을 기록하거나 전송하지 않는다. 계산 화면은 그대로 동작한다.
      setPhase({ kind: 'failed' });
    }
  };

  const busy = phase.kind === 'working';
  return (
    <section className="export-panel" aria-labelledby="export-heading">
      <h4 id="export-heading">{t('plan.export.heading')}</h4>
      <p className="qt-note">{t('plan.export.note')}</p>
      <label className="field field--inline">
        <span>{t('plan.export.scope')}</span>
        <select value={monthSel ?? ''} onChange={(e) => setMonth(e.target.value)}>
          <option value="">{t('plan.export.allMonths')}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <div className="export-panel__buttons">
        <button type="button" className="btn" disabled={busy} onClick={() => void run('xlsx')}>
          {t('plan.export.xlsx')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void run('pdf-list')}>
          {t('plan.export.pdfList')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void run('pdf-month')}>
          {t('plan.export.pdfMonth')}
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          {t('plan.export.print')}
        </button>
      </div>
      <p role="status" className="export-panel__status">
        {phase.kind === 'working' && t('plan.export.working')}
        {phase.kind === 'done' && t('plan.export.done', { file: phase.file })}
        {phase.kind === 'failed' && t('plan.export.failed')}
      </p>
    </section>
  );
}
