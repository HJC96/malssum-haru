import { LANGS, useI18n } from '@/i18n';

/** 화면 언어 전환. 언어만 바꾸며 다른 상태(계획 입력 등)에는 접근하지 않는다. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-switch__btn"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {t(code === 'ko' ? 'lang.ko' : 'lang.en')}
        </button>
      ))}
    </div>
  );
}
