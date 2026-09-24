import { useId } from 'react';
import {
  formatIsoDate,
  formatPassageText,
  isMessageKey,
  localIsoDate,
  useI18n,
  type MessageKey,
} from '@/i18n';
import type { QtProvider, QtViewStatus } from '@/app/qt/types';
import { ExternalLinkButton } from './ExternalLinkButton';

interface Props {
  provider: QtProvider;
  /** 사용자 현지 날짜 비교용. 테스트에서 고정한다. */
  now?: Date;
}

/** 범위가 실제로 있을 때만 RANGE_CONFIRMED로 취급한다. 없으면 추정하지 않고 확인 못 함으로 내린다. */
function effectiveStatus(p: QtProvider): QtViewStatus {
  if (p.availabilityStatus !== 'RANGE_CONFIRMED') return p.availabilityStatus;
  return p.passage && p.passage.ranges.length > 0 ? 'RANGE_CONFIRMED' : 'RANGE_UNAVAILABLE';
}

/**
 * 제공처 한 곳의 오늘 QT 카드. 계약 v1의 5개 상태를 모두 처리한다.
 * 이 컴포넌트는 일독 계획 상태를 알지 못하며, 열람 기록을 남기지 않는다(AC01).
 */
export function QtProviderCard({ provider, now }: Props) {
  const { lang, t } = useI18n();
  const headingId = useId();
  const status = effectiveStatus(provider);
  const ranges = status === 'RANGE_CONFIRMED' ? (provider.passage?.ranges ?? []) : [];
  const name = provider.providerName[lang];

  const localDate = localIsoDate(now ?? new Date());
  const dateDiffers = provider.providerDate !== null && provider.providerDate !== localDate;
  const isSeoul = provider.providerTimeZone === 'Asia/Seoul';

  const reasonKey = `qt.reason.${provider.reasonCode ?? ''}`;
  const reason = status !== 'RANGE_CONFIRMED' && isMessageKey(reasonKey) ? t(reasonKey) : null;
  const notice = provider.notice?.[lang];

  return (
    <article className={`qt-card qt-card--${status}`} aria-labelledby={headingId} data-status={status}>
      <header className="qt-card__header">
        <h3 id={headingId} className="qt-card__title">
          {name}
        </h3>
        <span className={`badge badge--${status}`}>{t(`qt.status.${status}.badge` as MessageKey)}</span>
      </header>

      <dl className="qt-meta">
        <div className="qt-meta__row">
          <dt>{t('qt.date.label')}</dt>
          <dd>
            {provider.providerDate ? (
              <>
                <time dateTime={provider.providerDate}>{formatIsoDate(provider.providerDate, lang)}</time>{' '}
                <span className="qt-meta__basis">
                  ({isSeoul ? t('qt.date.kst') : provider.providerTimeZone})
                </span>
              </>
            ) : (
              <span>{t('qt.date.unknown')}</span>
            )}
          </dd>
        </div>
        {status === 'RANGE_CONFIRMED' && (
          <div className="qt-meta__row">
            <dt>{t('qt.passage.label')}</dt>
            <dd className="qt-passage">
              <span className="qt-passage__main">{formatPassageText(ranges, lang)}</span>
              {lang === 'en' && (
                <span className="qt-passage__ko">
                  {t('qt.passage.inKorean')}: <span lang="ko">{formatPassageText(ranges, 'ko')}</span>
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {dateDiffers && (
        <p className="qt-note">{t('qt.date.localDiffers', { localDate })}</p>
      )}

      {status === 'RANGE_CONFIRMED' ? (
        <p className="qt-note">{notice ?? t('qt.body.notProvided')}</p>
      ) : (
        <div className="qt-status-text">
          <p>{t(`qt.status.${status}.body` as MessageKey)}</p>
          {reason && <p className="qt-note">{reason}</p>}
        </div>
      )}

      {lang === 'en' && <p className="qt-note">{t('qt.passage.sourceKorean')}</p>}

      <div className="qt-card__actions">
        {provider.officialUrl ? (
          <>
            <ExternalLinkButton href={provider.officialUrl} label={t('qt.link.go', { provider: name })} />
            <p className="qt-note">
              {provider.officialUrlKind ? `${t(`qt.link.kind.${provider.officialUrlKind}`)} ` : ''}
              {t('qt.link.external')}
            </p>
          </>
        ) : (
          <p className="qt-note">{t('qt.status.noLink')}</p>
        )}
      </div>
    </article>
  );
}
