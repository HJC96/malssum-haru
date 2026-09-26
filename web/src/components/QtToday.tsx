import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import { fallbackLinks, fetchQtToday } from '@/app/qt/fetchQtToday';
import { applyFreshness, seoulDate } from '@/app/qt/freshness';
import type { QtTodayResponse } from '@/app/qt/types';
import { ErrorBoundary } from './ErrorBoundary';
import { ExternalLinkButton } from './ExternalLinkButton';
import { QtProviderCard } from './QtProviderCard';

type Fetcher = (options: { signal: AbortSignal }) => Promise<QtTodayResponse>;

export interface QtTodayProps {
  /** Whether the QT service panel is selected in the app shell. */
  isActive?: boolean;
  fetcher?: Fetcher;
  /** 고정 시각(테스트). `clock`이 없으면 이 값을 계속 현재로 본다. */
  now?: Date;
  /** 현재 시각을 돌려주는 함수. 신선도 판단과 재요청 시점이 이것을 따른다(테스트에서 주입). */
  clock?: () => Date;
  /** 서울 날짜 변경·탭 재활성화를 확인하는 주기(ms). 기본 30초. */
  checkIntervalMs?: number;
  /** 날짜가 안 바뀌어도 다시 조회하는 주기(ms). 기본 5분(서버 응답 max-age 60초 이상). */
  refreshIntervalMs?: number;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: QtTodayResponse; fetchedAtMs: number; refreshing: boolean }
  | { kind: 'error' };

/** API 전체 실패·렌더 오류 때 보여 주는 범위 없는 기본 공식 링크. */
function FallbackLinks({ now }: { now?: Date | undefined }) {
  const { lang, t } = useI18n();
  return (
    <>
      <p className="qt-note">{t('qt.fallback.note')}</p>
      <ul className="qt-fallback">
        {fallbackLinks(now).map((l) => (
          <li key={l.providerId}>
            <ExternalLinkButton href={l.url} label={t('qt.link.go', { provider: l.providerName[lang] })} />
          </li>
        ))}
      </ul>
    </>
  );
}

const MIN_REFETCH_GAP_MS = 10_000;

function QtTodayContent({
  isActive = true,
  fetcher = fetchQtToday,
  now,
  clock,
  checkIntervalMs = 30_000,
  refreshIntervalMs = 300_000,
}: QtTodayProps) {
  const { t } = useI18n();
  // 시계 함수가 렌더마다 바뀌어도 요청 효과가 다시 돌지 않도록 ref로 들고 있는다.
  const clockRef = useRef<() => Date>(() => new Date());
  clockRef.current = clock ?? (() => now ?? new Date());
  const readClock = useCallback(() => clockRef.current(), []);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [nowMs, setNowMs] = useState(() => readClock().getTime());
  const lastFetchStartMs = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    lastFetchStartMs.current = readClock().getTime();
    // 이미 받은 데이터가 있으면 지우지 않고 뒤에서 갱신한다(날짜가 바뀐 경우에만 카드가 '재확인 중'이 된다).
    setState((prev) => (prev.kind === 'ready' ? { ...prev, refreshing: true } : { kind: 'loading' }));
    fetcher({ signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return;
        const at = readClock().getTime();
        setNowMs(at);
        setState({ kind: 'ready', data, fetchedAtMs: at, refreshing: false });
      },
      () => {
        if (controller.signal.aborted) return;
        setNowMs(readClock().getTime());
        // 방금 받은 데이터가 그날 안이면 유지하고, 아니면 오류로 바꾼다(어제 범위를 붙잡고 있지 않는다).
        setState((prev) =>
          prev.kind === 'ready' && seoulDate(prev.fetchedAtMs) === seoulDate(readClock().getTime())
            ? { ...prev, refreshing: false }
            : { kind: 'error' },
        );
      },
    );
    return () => controller.abort();
  }, [fetcher, attempt, readClock]);

  // 주기적으로 시각을 다시 읽고(서울 자정 감지), 탭이 다시 보이면 즉시 확인한다.
  useEffect(() => {
    const tick = () => {
      if (isActive) setNowMs(readClock().getTime());
    };
    const id = setInterval(tick, checkIntervalMs);
    const onVisible = () => {
      if (isActive && document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [readClock, checkIntervalMs, isActive]);

  // Selecting QT rechecks the Seoul date immediately. The normal freshness
  // effect below fetches only when the cached response belongs to an older day.
  useEffect(() => {
    if (isActive) setNowMs(readClock().getTime());
  }, [isActive, readClock]);

  // 서울 날짜가 응답을 받은 날과 달라졌으면 다시 요청한다(과도한 반복은 최소 간격으로 막는다).
  const fetchedSeoul = state.kind === 'ready' ? seoulDate(state.fetchedAtMs) : null;
  const nowSeoul = seoulDate(nowMs);
  const dayRolled =
    state.kind === 'ready' && state.data.origin !== 'mock' && !state.refreshing && fetchedSeoul !== null && fetchedSeoul < nowSeoul;
  useEffect(() => {
    if (dayRolled && nowMs - lastFetchStartMs.current >= MIN_REFETCH_GAP_MS) setAttempt((n) => n + 1);
  }, [dayRolled, nowMs]);

  // 날짜가 안 바뀌어도 일정 주기로 갱신한다(탭이 보일 때만).
  useEffect(() => {
    const id = setInterval(() => {
      if (isActive && document.visibilityState === 'visible') setAttempt((n) => n + 1);
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs, isActive]);

  const cards = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const skip = state.data.origin === 'mock'; // 개발용 샘플은 날짜를 고정해 두었으므로 신선도 판단에서 뺀다.
    return state.data.providers.map((p) =>
      skip ? { provider: p, checking: false } : applyFreshness(p, seoulDate(state.fetchedAtMs), nowSeoul),
    );
  }, [state, nowSeoul]);

  return (
    <section className="qt-section" aria-labelledby="qt-heading" aria-busy={state.kind === 'loading'}>
      <h2 id="qt-heading">{t('qt.heading')}</h2>
      <p className="qt-intro">{t('qt.intro')}</p>
      <p className="qt-note">{t('qt.independent')}</p>
      {state.kind === 'ready' && state.data.origin === 'mock' && (
        <p className="qt-mock-banner" role="note">
          {t('qt.mockBanner')}
        </p>
      )}

      {state.kind === 'loading' && <p role="status">{t('qt.loading')}</p>}

      {state.kind === 'error' && (
        <div className="qt-error" role="alert">
          <h3>{t('qt.loadError.title')}</h3>
          <p>{t('qt.loadError.body')}</p>
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
            {t('qt.retry')}
          </button>
          <FallbackLinks now={new Date(nowMs)} />
        </div>
      )}

      {state.kind === 'ready' && (
        <ul className="qt-grid">
          {cards.map(({ provider, checking }) => (
            <li key={provider.providerId}>
              <QtProviderCard provider={provider} checking={checking} now={new Date(nowMs)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 오늘 QT 영역. 이 안의 어떤 실패도 바깥(일독 계획 화면)으로 번지지 않는다. */
export function QtToday(props: QtTodayProps) {
  const { t } = useI18n();
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <section className="qt-section" aria-labelledby="qt-heading">
          <h2 id="qt-heading">{t('qt.heading')}</h2>
          <div className="qt-error" role="alert">
            <h3>{t('qt.loadError.title')}</h3>
            <p>{t('qt.loadError.renderBody')}</p>
            <button type="button" className="btn" onClick={reset}>
              {t('qt.retry')}
            </button>
            <FallbackLinks now={props.now} />
          </div>
        </section>
      )}
    >
      <QtTodayContent {...props} />
    </ErrorBoundary>
  );
}
