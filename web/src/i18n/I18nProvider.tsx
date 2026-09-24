import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { detectLang, type Lang } from './lang';
import { translate, type MessageKey, type TranslateParams } from './messages';

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18n | null>(null);

/**
 * 화면 언어만 관리한다. 계획 입력·계산 결과·QT 상태는 이 Provider의 상태와 무관하며,
 * 언어를 바꿔도 자식 컴포넌트를 다시 만들지 않고(같은 트리 위치 유지) 문자열만 바뀐다(AC18).
 * 언어는 메모리에만 둔다. 브라우저 저장소·쿠키·URL에 쓰지 않는다.
 */
export function I18nProvider({ initialLang, children }: { initialLang?: Lang; children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => initialLang ?? detectLang(typeof navigator === 'undefined' ? undefined : navigator.languages),
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: MessageKey, params?: TranslateParams) => translate(lang, key, params), [lang]);
  const value = useMemo<I18n>(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n은 I18nProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
