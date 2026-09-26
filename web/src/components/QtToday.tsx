import { useCallback, useEffect, useState } from 'react';
import { loadDailyWord } from '@/app/dailyWord/loader';
import type { DailyWordContent } from '@/app/dailyWord/types';
import { localIsoDate } from '@/i18n';
import { fallbackLinks } from '@/app/qt/fetchQtToday';
import { useI18n } from '@/i18n';
import { DailyWordSection, type DailyWordStatus } from './DailyWordSection';
import { ErrorBoundary } from './ErrorBoundary';
import { ExternalLinkButton } from './ExternalLinkButton';

type DailyWordLoader = (date: string) => Promise<DailyWordContent | null>;

export interface QtTodayProps {
  /** Whether the QT service panel is selected in the app shell. */
  isActive?: boolean;
  /** Daily-word fetch seam for deterministic tests; it reads only the exact Seoul date. */
  dailyWordLoader?: DailyWordLoader;
  /** @deprecated Kept temporarily for older app callers; provider passage fetching is no longer used. */
  fetcher?: unknown;
  /** @deprecated Provider polling has been replaced by daily-date artifact lookup. */
  refreshIntervalMs?: number;
  now?: Date;
  clock?: () => Date;
  checkIntervalMs?: number;
}

function SeoulDateClock({
  isActive,
  now,
  clock,
  checkIntervalMs,
  onDate,
}: {
  isActive: boolean;
  now?: Date;
  clock?: () => Date;
  checkIntervalMs: number;
  onDate: (date: string) => void;
}) {
  const readDate = useCallback(() => localIsoDate(clock?.() ?? now ?? new Date(), 'Asia/Seoul'), [clock, now]);
  useEffect(() => {
    const tick = () => {
      if (isActive) onDate(readDate());
    };
    tick();
    const id = window.setInterval(tick, checkIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkIntervalMs, isActive, onDate, readDate]);
  return null;
}

function ErrorFallback({ now }: { now?: Date }) {
  const { lang, t } = useI18n();
  return (
    <section className="qt-section" aria-labelledby="qt-heading">
      <h2 id="qt-heading">{t('dailyWord.heading')}</h2>
      <div className="qt-error" role="alert">
        <p>{t('dailyWord.error')}</p>
        <ul className="qt-fallback">
          {fallbackLinks(now).map((link) => <li key={link.providerId}>
            <ExternalLinkButton href={link.url} label={t('qt.link.go', { provider: link.providerName[lang] })} />
          </li>)}
        </ul>
      </div>
    </section>
  );
}

function QtTodayContent({
  isActive = true,
  dailyWordLoader = loadDailyWord,
  now,
  clock,
  checkIntervalMs = 30_000,
}: QtTodayProps) {
  const getNow = useCallback(() => clock?.() ?? now ?? new Date(), [clock, now]);
  const [date, setDate] = useState(() => localIsoDate(getNow(), 'Asia/Seoul'));
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ date: string; status: DailyWordStatus; content: DailyWordContent | null }>({
    date: localIsoDate(getNow(), 'Asia/Seoul'),
    status: 'loading',
    content: null,
  });
  const updateDate = useCallback((next: string) => setDate((previous) => previous === next ? previous : next), []);

  useEffect(() => {
    let current = true;
    setState({ date, status: 'loading', content: null });
    dailyWordLoader(date).then(
      (content) => {
        if (current) setState({ date, status: content ? 'ready' : 'unavailable', content });
      },
    ).catch(() => {
      if (current) setState({ date, status: 'error', content: null });
    });
    return () => { current = false; };
  }, [dailyWordLoader, date, attempt]);

  return (
    <>
      <SeoulDateClock isActive={isActive} now={now} clock={clock} checkIntervalMs={checkIntervalMs} onDate={updateDate} />
      <DailyWordSection
        date={date}
        content={state.date === date ? state.content : null}
        status={state.date === date ? state.status : 'loading'}
        now={getNow()}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    </>
  );
}

/** Today’s Scripture panel; content errors never affect the independent reading-plan tab. */
export function QtToday(props: QtTodayProps) {
  return (
    <ErrorBoundary fallback={() => <ErrorFallback now={props.now} />}>
      <QtTodayContent {...props} />
    </ErrorBoundary>
  );
}
