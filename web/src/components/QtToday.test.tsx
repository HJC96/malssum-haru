import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import type { DailyWordContent } from '@/app/dailyWord/types';
import { renderWithLang } from '@/app/test/render';
import { I18nProvider } from '@/i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { QtToday } from './QtToday';

const testContent = (date = '2026-09-26'): DailyWordContent => ({
  schemaVersion: '1', date, timeZone: 'Asia/Seoul', contentVersion: `test-only-${date}`,
  oldTestament: {
    reference: { bookId: 'GEN', chapter: 1, verse: 1 }, translationId: 'test-only-not-a-translation', textLanguage: 'ko',
    text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT AN EXPLANATION]', kind: 'editorial', language: 'ko' },
    source: { name: 'Test-only source', url: 'https://example.invalid/test' },
  },
  newTestament: {
    reference: { bookId: 'MAT', chapter: 1, verse: 1 }, translationId: 'test-only-not-a-translation', textLanguage: 'ko',
    text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT AN EXPLANATION]', kind: 'editorial', language: 'ko' },
    source: { name: 'Test-only source', url: 'https://example.invalid/test' },
  },
});
const TODAY = new Date('2026-09-26T03:00:00.000Z');

describe('오늘의 말씀 화면', () => {
  it('서울 오늘 artifact의 구약·신약 말씀과 해설을 보여준다', async () => {
    const loader = vi.fn(async (date: string) => testContent(date));
    renderWithLang(<QtToday dailyWordLoader={loader} now={TODAY} />);

    expect(screen.getByRole('status')).toHaveTextContent('오늘의 말씀을 확인하고 있습니다');
    expect(await screen.findByRole('article', { name: '창세기 1:1' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: '마태복음 1:1' })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith('2026-09-26');
    expect(screen.getByRole('link', { name: /매일성경/ })).toHaveAttribute('href', 'https://sum.su.or.kr:8888/bible/today');
    expect(screen.getByRole('link', { name: /생명의삶/ })).toHaveAttribute('href', 'https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-26');
  });

  it('정확한 오늘 자료가 없으면 전날 자료를 대체하지 않고 공식 링크를 제공한다', async () => {
    const loader = vi.fn(async () => null);
    renderWithLang(<QtToday dailyWordLoader={loader} now={TODAY} />);
    expect(await screen.findByText('오늘 표시할 말씀 자료가 아직 준비되지 않았습니다. 아래 공식 QT 사이트에서 오늘 본문을 확인해 주세요.')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByRole('heading', { name: '구절 자료 미등록' })).toHaveLength(2);
    expect(screen.queryByText('[TEST ONLY — NOT SCRIPTURE]')).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith('2026-09-26');
    expect(screen.getAllByRole('link', { name: /매일성경|생명의삶|날마다 솟는 샘물/ })).toHaveLength(3);
  });

  it('로드 실패 시 QT 영역만 오류를 내고 다시 시도할 수 있다', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(testContent());
    renderWithLang(<QtToday dailyWordLoader={loader} now={TODAY} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('오늘의 말씀을 불러오지 못했습니다');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('article', { name: '창세기 1:1' })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('페이지 전환과 비저장', () => {
  it('탭 왕복은 오늘 말씀 자료를 재요청하지 않는다', async () => {
    const loader = vi.fn(async (date: string) => testContent(date));
    render(<App initialLang="ko" initialService="qt" dailyWordLoader={loader} now={TODAY} />);
    await screen.findByRole('article', { name: '창세기 1:1' });
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    await userEvent.click(screen.getByRole('tab', { name: '오늘의 QT' }));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('QT 표시와 테마 전환은 브라우저 저장소·쿠키·URL에 쓰지 않는다', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const cookie = vi.spyOn(document, 'cookie', 'set');
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    const before = window.location.href;
    render(<App initialLang="ko" initialService="qt" dailyWordLoader={async () => null} now={TODAY} />);
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('button', { name: '밤 모드' }));
    expect(setItem).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    vi.restoreAllMocks();
  });
});

describe('ErrorBoundary 격리', () => {
  function Bomb(): never { throw new Error('boom'); }
  function Counter() { return <button type="button">계획 계산</button>; }

  it('자식이 던져도 바깥 형제의 화면이 유지된다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Counter />
        <ErrorBoundary fallback={() => <p>대체 화면</p>}><Bomb /></ErrorBoundary>
      </>,
    );
    expect(screen.getByText('대체 화면')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계획 계산' })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('서울 날짜 rollover', () => {
  it('날짜 변경 시 어제 콘텐츠를 지우고 오늘 artifact만 요청한다', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    let clockMs = Date.parse('2026-09-26T14:50:00Z'); // 23:50 KST
    const clock = () => new Date(clockMs);
    const loader = vi.fn(async (date: string) => date === '2026-09-26' ? testContent(date) : null);
    render(
      <I18nProvider initialLang="ko">
        <QtToday dailyWordLoader={loader} clock={clock} checkIntervalMs={30_000} />
      </I18nProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('article', { name: '창세기 1:1' })).toBeInTheDocument();
    clockMs = Date.parse('2026-09-26T15:05:00Z'); // 00:05 KST on 09-27
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText('오늘 표시할 말씀 자료가 아직 준비되지 않았습니다. 아래 공식 QT 사이트에서 오늘 본문을 확인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: '창세기 1:1' })).not.toBeInTheDocument();
    expect(loader).toHaveBeenLastCalledWith('2026-09-27');
    vi.useRealTimers();
  });
});
