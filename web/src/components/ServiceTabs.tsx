import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n';

export type ServiceTab = 'qt' | 'plan';

interface ServiceTabsProps {
  value: ServiceTab;
  onChange: (value: ServiceTab) => void;
}

const tabs: readonly ServiceTab[] = ['qt', 'plan'];

/** Two top-level service tabs with manual activation and roving focus. */
export function ServiceTabs({ value, onChange }: ServiceTabsProps) {
  const { t } = useI18n();
  const [focusedTab, setFocusedTab] = useState<ServiceTab>(value);
  const refs = useRef<Record<ServiceTab, HTMLButtonElement | null>>({ qt: null, plan: null });

  useEffect(() => setFocusedTab(value), [value]);

  const moveFocus = (next: ServiceTab) => {
    setFocusedTab(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="service-tabs" role="tablist" aria-label={t('app.services.label')}>
      {tabs.map((tab) => (
        <button
          key={tab}
          ref={(node) => { refs.current[tab] = node; }}
          className="service-tabs__tab"
          type="button"
          role="tab"
          id={`service-tab-${tab}`}
          aria-controls={`service-panel-${tab}`}
          aria-selected={value === tab}
          tabIndex={focusedTab === tab ? 0 : -1}
          onFocus={() => setFocusedTab(tab)}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => {
            const index = tabs.indexOf(tab);
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              moveFocus(tabs[(index + 1) % tabs.length]!);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              moveFocus(tabs[(index + tabs.length - 1) % tabs.length]!);
            } else if (event.key === 'Home') {
              event.preventDefault();
              moveFocus(tabs[0]!);
            } else if (event.key === 'End') {
              event.preventDefault();
              moveFocus(tabs[tabs.length - 1]!);
            }
          }}
        >
          {t(tab === 'qt' ? 'app.services.qt' : 'app.services.plan')}
        </button>
      ))}
    </div>
  );
}
