import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { maeilConfirmed } from '@/app/qt/fixtures';
import { normalizeQtToday } from '@/app/qt/normalize';
import type { QtTodayResponse } from '@/app/qt/types';
import { I18nProvider } from '@/i18n';
import { QtToday } from './QtToday';

const KST_2300 = Date.parse('2026-09-24T14:00:00Z'); // 09-24 23:00 KST
const KST_0030 = Date.parse('2026-09-24T15:30:00Z'); // 09-25 00:30 KST

const day = (date: string, chapter: number): QtTodayResponse =>
  normalizeQtToday({
    schemaVersion: '1',
    generatedAt: '',
    providers: [{ ...maeilConfirmed(), providerDate: date, passage: { ranges: [{ bookId: 'JHN', start: { chapter, verse: 1 }, end: { chapter, verse: 5 } }] } }],
  });

let clockMs = KST_2300;
const clock = () => new Date(clockMs);

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const setup = async (responses: Array<QtTodayResponse | Error>, extra: Partial<Parameters<typeof QtToday>[0]> = {}) => {
  let i = 0;
  const fetcher = vi.fn(async () => {
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return r as QtTodayResponse;
  });
  render(
    <I18nProvider initialLang="ko">
      <QtToday fetcher={fetcher} clock={clock} checkIntervalMs={30_000} refreshIntervalMs={300_000} {...extra} />
    </I18nProvider>,
  );
  await flush();
  return fetcher;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  clockMs = KST_2300;
});
afterEach(() => {
  vi.useRealTimers();
  delete (document as unknown as { visibilityState?: unknown }).visibilityState;
});

describe('QT 신선도: 서울 자정을 넘긴 탭 (F-06)', () => {
  it('자정 전에는 오늘 범위를 그대로 보인다', async () => {
    await setup([day('2026-09-24', 3)]);
    expect(screen.getByText('요한복음 3:1–5')).toBeInTheDocument();
    expect(screen.queryByText('다시 확인 중')).not.toBeInTheDocument();
  });

  it('서울 날짜가 바뀌면 어제 범위를 지우고 "다시 확인 중"을 보이며, 다시 요청해 새 범위를 보인다', async () => {
    const fetcher = await setup([day('2026-09-24', 3), day('2026-09-25', 4)]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    clockMs = KST_0030;
    // 요청이 끝나기 전 상태를 보려고 다음 응답을 보류한다
    let release!: (r: QtTodayResponse) => void;
    fetcher.mockImplementationOnce(() => new Promise<QtTodayResponse>((r) => (release = r)));
    await flush(30_000); // 확인 주기가 지나 서울 날짜 변경을 감지한다

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByText('다시 확인 중')).toBeInTheDocument();
    expect(screen.getByText(/날짜가 바뀌어 오늘 범위를 다시 확인/)).toBeInTheDocument();
    expect(screen.queryByText('요한복음 3:1–5')).not.toBeInTheDocument(); // 어제 범위를 오늘로 단정하지 않는다
    expect(screen.queryByText('오늘의 범위')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /공식 페이지로 이동/ })).toBeInTheDocument(); // 링크는 유지

    await act(async () => release(day('2026-09-25', 4)));
    expect(screen.getByText('요한복음 4:1–5')).toBeInTheDocument();
    expect(screen.queryByText('다시 확인 중')).not.toBeInTheDocument();
  });

  it('다시 요청해도 서버가 어제 날짜를 주면 그 범위를 쓰지 않고 날짜 불일치로 안내한다', async () => {
    await setup([day('2026-09-24', 3), day('2026-09-24', 3)]);
    clockMs = KST_0030;
    await flush(30_000);
    expect(screen.queryByText('요한복음 3:1–5')).not.toBeInTheDocument();
    expect(screen.getByText('범위 확인 못함')).toBeInTheDocument();
    expect(screen.getByText(/날짜가 오늘과 달라 그 자료를 사용하지 않았습니다/)).toBeInTheDocument();
  });

  it('탭이 다시 보일 때(visibilitychange) 즉시 날짜를 확인하고 다시 요청한다', async () => {
    const fetcher = await setup([day('2026-09-24', 3), day('2026-09-25', 4)], { checkIntervalMs: 3_600_000 });
    clockMs = KST_0030;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByText('요한복음 4:1–5')).toBeInTheDocument();
  });

  it('날짜가 안 바뀌어도 일정 주기로 갱신한다(탭이 보일 때만)', async () => {
    const fetcher = await setup([day('2026-09-24', 3)]);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await flush(300_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await flush(300_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByText('요한복음 3:1–5')).toBeInTheDocument(); // 같은 날이면 화면을 비우지 않는다
  });

  it('갱신이 실패하면 그날 안에는 이전 화면을 유지하고, 날짜가 바뀐 뒤에는 오류로 바꾼다', async () => {
    await setup([day('2026-09-24', 3), new Error('down')]);
    const vis = Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    void vis;
    await flush(300_000);
    expect(screen.getByText('요한복음 3:1–5')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    clockMs = KST_0030;
    await flush(300_000);
    expect(screen.getByRole('alert')).toHaveTextContent('QT 정보를 불러오지 못했습니다');
    expect(screen.queryByText('요한복음 3:1–5')).not.toBeInTheDocument();
  });

  it('요청이 계속 같은 날짜를 돌려줘도 요청이 폭주하지 않는다', async () => {
    const fetcher = await setup([day('2026-09-24', 3)]);
    clockMs = KST_0030;
    await flush(30_000);
    const after = fetcher.mock.calls.length;
    await flush(120_000); // 체크 4회
    expect(fetcher.mock.calls.length - after).toBeLessThanOrEqual(1);
  });

  it('개발용 mock 응답은 신선도 판단에서 제외한다(고정 날짜를 계속 요청하지 않는다)', async () => {
    const mock = { ...day('2026-09-24', 3), origin: 'mock' as const };
    const fetcher = await setup([mock]);
    expect(screen.getByRole('note')).toHaveTextContent('개발용 샘플 데이터');
    clockMs = KST_0030;
    await flush(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText('요한복음 3:1–5')).toBeInTheDocument();
  });

  it('언마운트하면 타이머와 이벤트 리스너를 정리한다', async () => {
    const fetcher = vi.fn(async () => day('2026-09-24', 3));
    const { unmount } = render(
      <I18nProvider initialLang="ko">
        <QtToday fetcher={fetcher} clock={clock} checkIntervalMs={30_000} refreshIntervalMs={300_000} />
      </I18nProvider>,
    );
    await flush();
    unmount();
    clockMs = KST_0030;
    await flush(600_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
