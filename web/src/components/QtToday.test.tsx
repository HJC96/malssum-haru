import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { App } from '@/app/App';
import { QT_MOCK_SCENARIOS } from '@/app/qt/fixtures';
import { normalizeQtToday } from '@/app/qt/normalize';
import type { QtTodayResponse } from '@/app/qt/types';
import { NOW, renderWithLang, scenario } from '@/app/test/render';
import { I18nProvider } from '@/i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { LanguageSwitch } from './LanguageSwitch';
import { QtToday } from './QtToday';

const ok = (name: keyof typeof QT_MOCK_SCENARIOS) => vi.fn(async () => scenario(name));

describe('QtToday 영역', () => {
  it('불러오는 동안 상태를 알리고, 두 제공처 카드를 그린다', async () => {
    renderWithLang(<QtToday fetcher={ok('mixed')} now={NOW} />);
    expect(screen.getByRole('status')).toHaveTextContent('QT 정보를 불러오는 중');
    expect(await screen.findByRole('article', { name: '매일성경' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: '생명의삶' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '오늘의 QT' })).toHaveAttribute('aria-busy', 'false');
  });

  it('QT 열람이 일독 계획에 반영되지 않는다고 안내한다(AC01)', async () => {
    renderWithLang(<QtToday fetcher={ok('confirmed')} now={NOW} />);
    expect(await screen.findByText(/일독 계획의 배정 범위나 진도에 반영되지 않습니다/)).toBeInTheDocument();
  });

  it('한 제공처가 실패해도 다른 제공처는 정상 표시된다', async () => {
    renderWithLang(<QtToday fetcher={ok('mixed')} now={NOW} />);
    const good = await screen.findByRole('article', { name: '매일성경' });
    const bad = screen.getByRole('article', { name: '생명의삶' });
    expect(within(good).getByText('요한복음 3:1–21')).toBeInTheDocument();
    expect(within(bad).getByText(/오늘 범위를 확인하지 못했습니다/)).toBeInTheDocument();
    expect(within(bad).getByRole('link')).toBeInTheDocument();
  });

  it('API 실패 시 오류를 알리고, 범위 없는 기본 공식 링크와 다시 시도를 제공한다', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(scenario('confirmed'));
    renderWithLang(<QtToday fetcher={fetcher} now={NOW} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('QT 정보를 불러오지 못했습니다');
    expect(alert).toHaveTextContent('일독 계획 계산은 그대로 사용할 수 있습니다');
    const links = within(alert).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.every((a) => a.getAttribute('href')?.startsWith('https://'))).toBe(true);
    expect(within(alert).queryByText(/요한복음|사도행전/)).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('article', { name: '매일성경' })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('스키마 버전이 다른 응답은 오류 화면으로 격리된다', async () => {
    const fetcher = vi.fn(async () => normalizeQtToday({ schemaVersion: '2', providers: [] }));
    renderWithLang(<QtToday fetcher={fetcher} now={NOW} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('QT 정보를 불러오지 못했습니다');
  });

  it('렌더 중 예외가 나도 QT 영역만 대체 화면이 된다', async () => {
    const broken = scenario('confirmed') as QtTodayResponse;
    // 정규화를 거치지 않은 비정상 데이터가 들어와도 바깥이 무너지지 않는지 확인한다.
    (broken.providers[0] as unknown as { providerName: unknown }).providerName = null;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <I18nProvider initialLang="ko">
        <QtToday fetcher={async () => broken} now={NOW} />
        <button type="button">계획 계산</button>
      </I18nProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('QT 영역에 문제가 생겼습니다');
    expect(screen.getByRole('button', { name: '계획 계산' })).toBeEnabled();
    spy.mockRestore();
  });

  it('언마운트 뒤 늦게 도착한 응답으로 상태를 바꾸지 않는다', async () => {
    let resolve!: (v: QtTodayResponse) => void;
    const fetcher = vi.fn(() => new Promise<QtTodayResponse>((r) => (resolve = r)));
    const { unmount } = renderWithLang(<QtToday fetcher={fetcher} now={NOW} />);
    unmount();
    await act(async () => resolve(scenario('confirmed')));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary 격리', () => {
  function Bomb(): never {
    throw new Error('boom');
  }
  function Counter() {
    const [n, setN] = useState(0);
    return (
      <button type="button" onClick={() => setN(n + 1)}>
        count {n}
      </button>
    );
  }

  it('자식이 던져도 바깥 형제의 상태와 동작은 그대로다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Counter />
        <ErrorBoundary fallback={() => <p>대체 화면</p>}>
          <Bomb />
        </ErrorBoundary>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'count 0' }));
    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument();
    expect(screen.getByText('대체 화면')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('언어 전환은 계획 입력 상태를 바꾸지 않는다 (AC18)', () => {
  let mounts = 0;
  /** 계획 입력 화면(T11)의 대역: 언어와 무관한 ISO 날짜 입력 상태를 가진다. */
  function PlanInputStub() {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    useState(() => {
      mounts += 1;
    });
    return (
      <form aria-label="plan">
        <input aria-label="start" value={start} onChange={(e) => setStart(e.target.value)} />
        <input aria-label="end" value={end} onChange={(e) => setEnd(e.target.value)} />
      </form>
    );
  }

  beforeEach(() => {
    mounts = 0;
  });

  it('언어를 바꿔도 입력값이 유지되고 컴포넌트가 다시 만들어지지 않는다', async () => {
    render(
      <I18nProvider initialLang="ko">
        <LanguageSwitch />
        <PlanInputStub />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('start'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('end'), { target: { value: '2027-09-30' } });

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByLabelText('start')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('end')).toHaveValue('2027-09-30');

    await userEvent.click(screen.getByRole('button', { name: '한국어' }));
    expect(screen.getByLabelText('start')).toHaveValue('2026-10-01');
    expect(mounts).toBe(1);
  });

  it('App: 언어 전환은 QT를 다시 요청하지 않고 표시만 바꾼다', async () => {
    const fetcher = ok('mixed');
    render(<App initialLang="ko" qtFetcher={fetcher} now={NOW} />);
    expect(await screen.findByText('요한복음 3:1–21')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '한국어' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('John 3:1–21')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: "Today's QT" })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('비저장 (AC20 취지)', () => {
  it('QT 표시와 언어 전환은 저장소·쿠키·URL에 아무것도 쓰지 않는다', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const cookie = vi.spyOn(document, 'cookie', 'set');
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    const before = window.location.href;

    render(<App initialLang="ko" qtFetcher={ok('mixed')} now={NOW} />);
    await screen.findByRole('article', { name: '매일성경' });
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(setItem).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    vi.restoreAllMocks();
  });
});

describe('페이지 구조와 키보드', () => {
  it('건너뛰기 링크가 첫 탭 대상이고 main으로 이동한다. 계획 영역이 QT와 함께 있다', async () => {
    render(<App initialLang="ko" qtFetcher={ok('mixed')} now={NOW} />);
    await screen.findByRole('article', { name: '매일성경' });
    await userEvent.tab();
    expect(screen.getByRole('link', { name: '본문으로 건너뛰기' })).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('heading', { level: 1, name: '말씀하루' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '일독 계획' })).toBeInTheDocument();
  });

  it('QT가 실패해도 계획 영역은 그대로 남아 있다(AC16 취지)', async () => {
    render(<App initialLang="ko" qtFetcher={vi.fn().mockRejectedValue(new Error('x'))} now={NOW} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('region', { name: '일독 계획' })).toBeInTheDocument();
  });
});
