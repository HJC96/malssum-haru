import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/i18n';
import { ServiceTabs, type ServiceTab } from './ServiceTabs';

describe('ServiceTabs', () => {
  it('shows translated names and uses manual activation with roving focus', async () => {
    const user = userEvent.setup();
    let selected: ServiceTab = 'qt';
    const onChange = vi.fn((tab: ServiceTab) => { selected = tab; });
    const view = () => render(
      <I18nProvider initialLang="ko">
        <ServiceTabs value={selected} onChange={onChange} />
      </I18nProvider>,
    );
    view();
    const qt = screen.getByRole('tab', { name: '오늘의 QT' });
    const plan = screen.getByRole('tab', { name: '성경 읽기 계획' });
    expect(qt).toHaveAttribute('aria-selected', 'true');
    expect(qt).toHaveAttribute('tabindex', '0');
    expect(plan).toHaveAttribute('tabindex', '-1');

    qt.focus();
    await user.keyboard('{ArrowRight}');
    expect(plan).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    expect(qt).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('plan');
    expect(screen.getByRole('tablist', { name: '서비스 선택' })).toBeInTheDocument();
  });

  it('Home and End move focus to the first and last tab', async () => {
    const user = userEvent.setup();
    render(<I18nProvider initialLang="en"><ServiceTabs value="plan" onChange={vi.fn()} /></I18nProvider>);
    const qt = screen.getByRole('tab', { name: "Today's QT" });
    const plan = screen.getByRole('tab', { name: 'Bible reading plan' });
    plan.focus();
    await user.keyboard('{Home}');
    expect(qt).toHaveFocus();
    await user.keyboard('{End}');
    expect(plan).toHaveFocus();
  });
});
