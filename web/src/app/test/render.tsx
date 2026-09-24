import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider, type Lang } from '@/i18n';
import { QT_MOCK_SCENARIOS, type QtMockScenario } from '@/app/qt/fixtures';
import { normalizeQtToday } from '@/app/qt/normalize';
import type { QtProvider, QtTodayResponse } from '@/app/qt/types';

/** 테스트 전용 렌더 헬퍼. 언어를 고정한 I18nProvider로 감싼다. */
export function renderWithLang(ui: ReactElement, lang: Lang = 'ko'): RenderResult {
  return render(<I18nProvider initialLang={lang}>{ui}</I18nProvider>);
}

export function scenario(name: QtMockScenario): QtTodayResponse {
  return normalizeQtToday(QT_MOCK_SCENARIOS[name]());
}

export function provider(name: QtMockScenario, index: 0 | 1): QtProvider {
  const p = scenario(name).providers[index];
  if (!p) throw new Error('fixture에 제공처가 없습니다.');
  return p;
}

/** 고정 시각: 서울 2026-09-24 오전 10시 = UTC 01:00. */
export const NOW = new Date('2026-09-24T01:00:00Z');
