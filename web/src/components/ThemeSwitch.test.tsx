import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitch } from './ThemeSwitch';

describe('낮/밤 모드 전환', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  });

  it('해/달 이모지 버튼으로 테마를 전환한다', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);

    const toggle = screen.getByRole('button', { name: '다크 모드로 전환' });
    expect(toggle).toHaveTextContent('☀️');
    await user.click(toggle);

    expect(screen.getByRole('button', { name: '낮 모드로 전환' })).toHaveTextContent('🌙');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
