import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { SAMPLE_BIBLE } from '@/domain';
import { LOCAL_NOON, fillRange, setDate } from '@/app/test/planUi';
import { scenario } from '@/app/test/render';

const app = () => (
  <App initialLang="ko" initialService="qt" now={LOCAL_NOON} planBible={SAMPLE_BIBLE} qtFetcher={async () => scenario('mixed')} planInitial={{ endDate: '2026-10-23' }} />
);

describe('개인 계획·진도는 저장하지 않는다 (AC20, AC19)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('입력·재계산·테마 전환·오류 상황 어디서도 저장소·쿠키·URL에 쓰지 않는다', async () => {
    const writes = [
      vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(Storage.prototype, 'removeItem'),
      vi.spyOn(Storage.prototype, 'clear'),
      vi.spyOn(document, 'cookie', 'set'),
      vi.spyOn(history, 'pushState'),
      vi.spyOn(history, 'replaceState'),
    ];
    const idbOpen = vi.fn();
    vi.stubGlobal('indexedDB', { open: idbOpen });
    const before = window.location.href;

    render(app());
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    setDate('시작일', '2026-09-10');
    await userEvent.click(screen.getByRole('radio', { name: /건너뛰어 읽었습니다/ }));
    const readGroup = screen.getByRole('group', { name: '현재 읽은 분량' });
    fillRange(within(readGroup).getByRole('group', { name: '범위 1' }), { book: 'GEN', sc: '1', sv: '1', ec: '1', ev: '8' });
    await userEvent.click(screen.getByRole('button', { name: '남은 일정 조정' }));
    await userEvent.click(screen.getByRole('button', { name: '이 일정으로 적용' }));
    await userEvent.click(within(screen.getByRole('group', { name: '오늘 읽은 범위 (선택)' })).getByRole('button', { name: '범위 추가' }));
    await userEvent.click(screen.getByRole('button', { name: '월간 캘린더' }));
    await userEvent.click(screen.getByRole('button', { name: '밤 모드' }));
    setDate('마감일', '2026-01-01'); // 오류 화면
    expect(screen.getByRole('alert')).toBeInTheDocument();

    for (const spy of writes) expect(spy).not.toHaveBeenCalled();
    expect(idbOpen).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    expect(document.cookie).toBe('');
    vi.unstubAllGlobals();
  });

  it('새로 열면(새로고침·재방문) 이전 입력이 복원되지 않고 기본값으로 시작한다', async () => {
    const first = render(app());
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    setDate('마감일', '2026-09-30');
    await userEvent.click(screen.getByRole('radio', { name: /처음부터 어디까지/ }));
    expect(screen.getByLabelText('마감일')).toHaveValue('2026-09-30');
    first.unmount();

    render(app());
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    await userEvent.click(screen.getByText('시작일·빠른 기간 설정', { selector: 'summary' }));
    expect(screen.getByRole('button', { name: '30일' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: /처음 시작합니다/ })).toBeChecked();
    expect(screen.queryByLabelText('마지막으로 읽은 곳')).not.toBeInTheDocument();
  });

  it('PlanSection 화면 소스는 저장소·쿠키·URL API를 쓰지 않는다', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { resolve, join } = await import('node:path');
    const roots = ['src/app', 'src/components', 'src/export', 'src/i18n'].map((r) => resolve(process.cwd(), r));
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.includes('/test/')) files.push(p);
      }
    };
    roots.forEach(walk);
    const forbidden = /localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|location\.(search|hash)\s*=|navigator\.sendBeacon|gtag\(|analytics/;
    const hits = files.filter((f) => forbidden.test(readFileSync(f, 'utf8'))).map((f) => f.replace(process.cwd(), ''));
    expect(hits).toEqual([]);
  });

  it('QT 요청(fetchQtToday)은 개인 입력을 포함하지 않는다', async () => {
    const { fetchQtToday, QT_TODAY_PATH } = await import('@/app/qt/fetchQtToday');
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(scenario('mixed')), { status: 200 }));
    render(app());
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    setDate('시작일', '2026-09-10');
    await fetchQtToday({ source: 'api', fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(QT_TODAY_PATH);
    expect(JSON.stringify(init)).not.toMatch(/2026-09-10|GEN|read/);
  });
});
