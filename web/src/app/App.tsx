import { useEffect, useRef, useState } from 'react';
import { I18nProvider, useI18n, type Lang } from '@/i18n';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { PlanSection } from '@/components/PlanSection';
import { QtToday } from '@/components/QtToday';
import { ServiceTabs, type ServiceTab } from '@/components/ServiceTabs';
import type { BibleData } from '@/domain';
import type { PlanFormState } from './plan/planForm';
import type { QtTodayResponse } from './qt/types';
import type { DailyWordContent } from './dailyWord/types';
import { recordVisitOncePerPageLoad } from './visits/recordVisit';

interface AppProps {
  initialLang?: Lang;
  qtFetcher?: (options: { signal: AbortSignal }) => Promise<QtTodayResponse>;
  dailyWordLoader?: (date: string) => Promise<DailyWordContent | null>;
  now?: Date;
  /** 테스트에서 계획 폼 초기값을 바꾼다. */
  planInitial?: Partial<PlanFormState>;
  /** 테스트에서 성경 데이터를 바꾼다. */
  planBible?: BibleData;
  /** 테스트에서 시작 화면을 건너뛰고 특정 서비스를 연다. 실제 기본 진입은 환영 화면이다. */
  initialService?: ServiceTab;
  /** 테스트에서 서버 방문 기록을 대체한다. */
  visitRecorder?: () => Promise<number | null>;
}

function Shell({ qtFetcher, dailyWordLoader, now, planInitial, planBible, initialService, visitRecorder = recordVisitOncePerPageLoad }: Pick<AppProps, 'qtFetcher' | 'dailyWordLoader' | 'now' | 'planInitial' | 'planBible' | 'initialService' | 'visitRecorder'>) {
  const { t } = useI18n();
  const [visitCount, setVisitCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ServiceTab>(initialService ?? 'qt');
  const [started, setStarted] = useState(initialService !== undefined);
  const [hasEntered, setHasEntered] = useState(initialService !== undefined);
  const [scrollRequest, setScrollRequest] = useState(0);
  const serviceStepRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let current = true;
    void visitRecorder().then((count) => {
      if (current) setVisitCount(count);
    }).catch(() => {
      if (current) setVisitCount(null);
    });
    return () => { current = false; };
  }, [visitRecorder]);

  useEffect(() => {
    if (!started) return;
    const frame = window.requestAnimationFrame(() => {
      serviceStepRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [started, scrollRequest]);

  const begin = (tab: ServiceTab) => {
    setActiveTab(tab);
    setHasEntered(true);
    setStarted(true);
    setScrollRequest((request) => request + 1);
  };

  const visitMessage = visitCount === null
    ? t('welcome.visitUnavailable')
    : t('welcome.visitCount', { count: visitCount.toLocaleString('ko-KR') });

  return (
    <>
      <a className="skip-link" href="#main">
        {t('app.skipToMain')}
      </a>
      <main id="main" className="app-main" tabIndex={-1}>
        <section className="welcome-hero" id="welcome" aria-labelledby="welcome-heading">
          <header className="app-header">
            <ThemeSwitch />
          </header>
          <div className="welcome-hero__content">
            <h2
              id="welcome-heading"
              className="welcome-hero__title"
              aria-label={`${t('welcome.salutation')} ${visitMessage}`}
              aria-live="polite"
            >
              <span className="welcome-hero__salutation">{t('welcome.salutation')}</span>
              <span className="welcome-hero__visit">{visitMessage}</span>
            </h2>
            <p className="welcome-hero__intro">{t('welcome.intro')}</p>
            <div className="welcome-hero__actions">
              <button className="welcome-hero__button welcome-hero__button--primary" onClick={() => begin('qt')} type="button">
                {t('welcome.qt')}
                <span aria-hidden="true">→</span>
              </button>
              <button className="welcome-hero__button welcome-hero__button--secondary" onClick={() => begin('plan')} type="button">
                {t('welcome.plan')}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>

        <section className="service-step" aria-label={t('welcome.stepLabel')} ref={serviceStepRef}>
          <div className="service-step__navigation">
            <ServiceTabs value={activeTab} onChange={(tab) => { setActiveTab(tab); setHasEntered(true); }} />
          </div>
          <div
            id="service-panel-qt"
            className="service-panel"
            role="tabpanel"
            aria-labelledby="service-tab-qt"
            hidden={activeTab !== 'qt'}
          >
            <QtToday isActive={activeTab === 'qt'} {...(dailyWordLoader ? { dailyWordLoader } : {})} {...(qtFetcher ? { fetcher: qtFetcher } : {})} {...(now ? { now } : {})} />
          </div>
          <div
            id="service-panel-plan"
            className="service-panel"
            role="tabpanel"
            aria-labelledby="service-tab-plan"
            hidden={activeTab !== 'plan'}
          >
            {hasEntered && <PlanSection {...(now ? { now } : {})} {...(planInitial ? { initialForm: planInitial } : {})} {...(planBible ? { bible: planBible } : {})} />}
          </div>
        </section>
      </main>
    </>
  );
}

export function App({ initialLang, qtFetcher, dailyWordLoader, now, planInitial, planBible, initialService, visitRecorder }: AppProps) {
  return (
    <I18nProvider {...(initialLang ? { initialLang } : {})}>
      <Shell {...(qtFetcher ? { qtFetcher } : {})} {...(dailyWordLoader ? { dailyWordLoader } : {})} {...(now ? { now } : {})} {...(planInitial ? { planInitial } : {})} {...(planBible ? { planBible } : {})} {...(initialService ? { initialService } : {})} {...(visitRecorder ? { visitRecorder } : {})} />
    </I18nProvider>
  );
}
