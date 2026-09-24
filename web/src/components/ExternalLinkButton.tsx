import { useI18n } from '@/i18n';

/**
 * 제공처(외부 사이트)로 이동하는 링크 버튼. 이동한다는 사실을 문구(공식 페이지로 이동)와
 * 아이콘, 스크린리더용 "(새 창에서 열림)"으로 모두 드러낸다.
 */
export function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  const { t } = useI18n();
  return (
    <a className="btn btn--external" href={href} target="_blank" rel="noopener noreferrer">
      <span>{label}</span>
      <span className="visually-hidden"> {t('qt.link.newTab')}</span>
      <svg className="btn__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path
          d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
