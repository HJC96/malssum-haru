import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitch } from './ThemeSwitch';

describe('낮/밤 모드 전환', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  });

  it('해와 달 버튼을 나란히 보여주고 각각 선택한다', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);

    const day = screen.getByRole('button', { name: '낮 모드' });
    const night = screen.getByRole('button', { name: '밤 모드' });
    expect(day).toHaveTextContent('☀️');
    expect(night).toHaveTextContent('🌙');
    expect(day).toHaveAttribute('aria-pressed', 'true');
    await user.click(night);

    expect(night).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(day);
    expect(day).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
