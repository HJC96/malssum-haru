import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { fallbackLinks, fetchQtToday } from '@/app/qt/fetchQtToday';
import type { QtTodayResponse } from '@/app/qt/types';
import { ErrorBoundary } from './ErrorBoundary';
import { ExternalLinkButton } from './ExternalLinkButton';
import { QtProviderCard } from './QtProviderCard';

type Fetcher = (options: { signal: AbortSignal }) => Promise<QtTodayResponse>;

interface Props {
  fetcher?: Fetcher;
  now?: Date;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: QtTodayResponse }
  | { kind: 'error' };

/** API 전체 실패·렌더 오류 때 보여 주는 범위 없는 기본 공식 링크. */
function FallbackLinks({ now }: { now?: Date }) {
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

function QtTodayContent({ fetcher = fetchQtToday, now }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetcher({ signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ kind: 'ready', data });
      },
      () => {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      },
    );
    return () => controller.abort();
  }, [fetcher, attempt]);

  return (
    <section className="qt-section" aria-labelledby="qt-heading" aria-busy={state.kind === 'loading'}>
      <h2 id="qt-heading">{t('qt.heading')}</h2>
      <p className="qt-intro">{t('qt.intro')}</p>
      <p className="qt-note">{t('qt.independent')}</p>

      {state.kind === 'loading' && <p role="status">{t('qt.loading')}</p>}

      {state.kind === 'error' && (
        <div className="qt-error" role="alert">
          <h3>{t('qt.loadError.title')}</h3>
          <p>{t('qt.loadError.body')}</p>
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
            {t('qt.retry')}
          </button>
          <FallbackLinks now={now} />
        </div>
      )}

      {state.kind === 'ready' && (
        <ul className="qt-grid">
          {state.data.providers.map((p) => (
            <li key={p.providerId}>
              <QtProviderCard provider={p} {...(now ? { now } : {})} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 오늘 QT 영역. 이 안의 어떤 실패도 바깥(일독 계획 화면)으로 번지지 않는다. */
export function QtToday(props: Props) {
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
            <FallbackLinks {...(props.now ? { now: props.now } : {})} />
          </div>
        </section>
      )}
    >
      <QtTodayContent {...props} />
    </ErrorBoundary>
  );
}
