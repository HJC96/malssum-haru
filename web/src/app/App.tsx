import { useState } from 'react';
import { I18nProvider, useI18n, type Lang } from '@/i18n';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { NoticesButton } from '@/components/NoticesDialog';
import { PlanSection } from '@/components/PlanSection';
import { QtToday } from '@/components/QtToday';
import { ServiceTabs, type ServiceTab } from '@/components/ServiceTabs';
import type { BibleData } from '@/domain';
import type { PlanFormState } from './plan/planForm';
import type { QtTodayResponse } from './qt/types';

interface AppProps {
  initialLang?: Lang;
  qtFetcher?: (options: { signal: AbortSignal }) => Promise<QtTodayResponse>;
  now?: Date;
  /** 테스트에서 계획 폼 초기값을 바꾼다. */
  planInitial?: Partial<PlanFormState>;
  /** 테스트에서 성경 데이터를 바꾼다. */
  planBible?: BibleData;
}

function Shell({ qtFetcher, now, planInitial, planBible }: Pick<AppProps, 'qtFetcher' | 'now' | 'planInitial' | 'planBible'>) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ServiceTab>('qt');
  return (
    <>
      <a className="skip-link" href="#main">
        {t('app.skipToMain')}
      </a>
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <LanguageSwitch />
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        <ServiceTabs value={activeTab} onChange={setActiveTab} />
        <div id="service-panel-qt" className="service-panel" role="tabpanel" aria-labelledby="service-tab-qt" hidden={activeTab !== 'qt'}>
          <QtToday isActive={activeTab === 'qt'} {...(qtFetcher ? { fetcher: qtFetcher } : {})} {...(now ? { now } : {})} />
        </div>
        <div id="service-panel-plan" className="service-panel" role="tabpanel" aria-labelledby="service-tab-plan" hidden={activeTab !== 'plan'}>
          <PlanSection {...(now ? { now } : {})} {...(planInitial ? { initialForm: planInitial } : {})} {...(planBible ? { bible: planBible } : {})} />
        </div>
      </main>
      <footer className="app-footer">
        <NoticesButton />
      </footer>
    </>
  );
}

export function App({ initialLang, qtFetcher, now, planInitial, planBible }: AppProps) {
  return (
    <I18nProvider {...(initialLang ? { initialLang } : {})}>
      <Shell {...(qtFetcher ? { qtFetcher } : {})} {...(now ? { now } : {})} {...(planInitial ? { planInitial } : {})} {...(planBible ? { planBible } : {})} />
    </I18nProvider>
  );
}
