import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SAMPLE_BIBLE } from '@/domain';
import { I18nProvider, type Lang } from '@/i18n';
import { PlanSection } from '@/components/PlanSection';
import type { PlanFormState } from '@/app/plan/planForm';

/** 로컬 시간대와 무관하게 로컬 날짜가 2026-09-24가 되는 시각. */
export const LOCAL_TODAY = '2026-09-24';
export const LOCAL_NOON = new Date(2026, 8, 24, 12, 0, 0);

export function renderPlan(opts: { lang?: Lang; initialForm?: Partial<PlanFormState>; extra?: ReactElement } = {}) {
  return render(
    <I18nProvider initialLang={opts.lang ?? 'ko'}>
      <PlanSection now={LOCAL_NOON} bible={SAMPLE_BIBLE} initialForm={{ endDate: '2026-10-23', ...opts.initialForm }} />
      {opts.extra}
    </I18nProvider>,
  );
}

export const setDate = (label: string, value: string) => {
  if (!screen.queryByLabelText(label) && /마감일|End date/.test(label)) {
    const customDates = screen.queryByRole('button', { name: /직접 날짜|Custom dates/ });
    if (customDates) fireEvent.click(customDates);
  }
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

export function stat(container: HTMLElement, key: string): string {
  const el = container.querySelector(`[data-stat="${key}"]`);
  if (!el) throw new Error(`통계 ${key}가 없습니다.`);
  return el.textContent ?? '';
}

export function fillRange(group: HTMLElement, values: { book?: string; sc?: string; sv?: string; ec?: string; ev?: string }) {
  const g = within(group);
  if (values.book !== undefined) fireEvent.change(g.getByLabelText('책'), { target: { value: values.book } });
  const map: Array<[string, string | undefined]> = [
    ['시작 장', values.sc],
    ['시작 절', values.sv],
    ['끝 장', values.ec],
    ['끝 절', values.ev],
  ];
  for (const [label, v] of map) if (v !== undefined) fireEvent.change(g.getByLabelText(label), { target: { value: v } });
}
