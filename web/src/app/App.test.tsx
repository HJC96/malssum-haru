import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './test/render';
import { App } from './App';

describe('첫 화면에서 서비스 화면으로 이동', () => {
  it('처음 화면 아래에 QT를 이어 보여주고 버튼으로 해당 영역에 이동한다', async () => {
    const user = userEvent.setup();
    const loader = vi.fn(async () => null);
    const visitRecorder = vi.fn(async () => 7);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    renderWithLang(<App initialLang="ko" dailyWordLoader={loader} visitRecorder={visitRecorder} now={new Date('2026-09-26T03:00:00.000Z')} />);

    expect(await screen.findByRole('heading', { name: '샬롬, 오늘 7번째로 방문해주셨군요!' })).toBeInTheDocument();
    expect(visitRecorder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'QT하러 가기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일독 계획 세우기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /오늘의 말씀/ })).toBeInTheDocument();
    await waitFor(() => expect(loader).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'QT하러 가기' }));
    expect(await screen.findByRole('region', { name: /오늘의 말씀/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '오늘의 QT' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '일독 계획 세우기' }));
    expect(screen.getByRole('tab', { name: '일독 계획' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '일독 계획' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '오늘의 QT' }));
    expect(screen.queryByRole('heading', { name: '일독 계획' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '샬롬, 오늘 7번째로 방문해주셨군요!' })).toBeInTheDocument();
    expect(visitRecorder).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /처음 화면으로/ })).not.toBeInTheDocument();
  });
});
