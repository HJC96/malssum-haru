import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatIsoDate, bookName, useI18n } from '@/i18n';
import { fallbackLinks } from '@/app/qt/fetchQtToday';
import type { DailyWordContent, DailyWordEntry } from '@/app/dailyWord/types';
import { translationDisplayName } from '@/app/dailyWord/translations';
import { ExternalLinkButton } from './ExternalLinkButton';
import { ScriptureIcon, type ScriptureIconName } from './ScriptureIcon';

export type BibleSocietyTranslationVersion = 'SAENEW' | 'GAE';

export function bibleSocietyPassageUrl(
  reference: DailyWordEntry['reference'],
  version: BibleSocietyTranslationVersion,
): string {
  const url = new URL('https://www.bskorea.or.kr/bible/korbibReadpage.php');
  url.search = new URLSearchParams({
    version,
    book: reference.bookId.toLowerCase(),
    chap: String(reference.chapter),
    sec: String(reference.verse),
    cVersion: '',
    fontSize: '15px',
    fontWeight: 'normal',
  }).toString();
  return url.toString();
}

export type DailyWordStatus = 'loading' | 'ready' | 'unavailable' | 'error';

interface Props {
  date: string;
  content: DailyWordContent | null;
  status: DailyWordStatus;
  now?: Date;
  onRetry?: () => void;
}

function VerseCard({ entry, testament }: { entry: DailyWordEntry; testament: 'old' | 'new' }) {
  const { lang, t } = useI18n();
  const headingId = useId();
  const translationLinksId = useId();
  const [translationLinksOpen, setTranslationLinksOpen] = useState(false);
  const reference = `${bookName(entry.reference.bookId, lang)} ${entry.reference.chapter}:${entry.reference.verse}`;
  return (
    <article className={`daily-word-card daily-word-card--${testament}`} aria-labelledby={headingId}>
      <header className="daily-word-card__header">
        <p className={`daily-word-card__eyebrow daily-word-card__eyebrow--${testament}`}>
          <ScriptureIcon name="book" />
          {t(testament === 'old' ? 'dailyWord.oldTestament' : 'dailyWord.newTestament')}
        </p>
        <h3 id={headingId}>{reference}</h3>
      </header>
      <p className="daily-word-card__text" lang={entry.textLanguage}>{entry.text}</p>
      <div
        className="daily-word-card__translation-wrap"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTranslationLinksOpen(false);
        }}
        onMouseEnter={() => setTranslationLinksOpen(true)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) setTranslationLinksOpen(false);
        }}
      >
        <button
          aria-controls={translationLinksId}
          aria-expanded={translationLinksOpen}
          className="daily-word-card__translation"
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setTranslationLinksOpen(false);
          }}
          onFocus={() => setTranslationLinksOpen(true)}
          onClick={() => setTranslationLinksOpen(true)}
          type="button"
        >
          {translationDisplayName(entry.translationId)}
        </button>
        {translationLinksOpen && (
          <div className="daily-word-card__translation-options" id={translationLinksId}>
            <a href={bibleSocietyPassageUrl(entry.reference, 'SAENEW')} target="_blank" rel="noopener noreferrer">
              {t('dailyWord.translation.new')}<span className="visually-hidden"> {t('qt.link.newTab')}</span>
            </a>
            <a href={bibleSocietyPassageUrl(entry.reference, 'GAE')} target="_blank" rel="noopener noreferrer">
              {t('dailyWord.translation.revised')}<span className="visually-hidden"> {t('qt.link.newTab')}</span>
            </a>
          </div>
        )}
      </div>
      <div className="daily-word-card__explanation">
        <h4><ScriptureIcon name="seedling" />{t('dailyWord.explanation')}</h4>
        <p lang={entry.explanation.language}>{entry.explanation.text}</p>
      </div>
    </article>
  );
}

export function DailyWordSection({ date, content, status, now, onRetry }: Props) {
  const { lang, t } = useI18n();
  const [selectionHelpOpen, setSelectionHelpOpen] = useState(false);
  const [selectionHelpPosition, setSelectionHelpPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const pointerIntent = useRef(false);
  const selectionHelpId = useId();
  const links = fallbackLinks(now);
  const selectionHelp = status === 'ready' && content && typeof document !== 'undefined'
    ? createPortal(
      <aside
        className="daily-word__selection-help"
        onMouseEnter={() => setSelectionHelpOpen(true)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) setSelectionHelpOpen(false);
        }}
        onPointerDown={(event) => {
          if (event.button != null && event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          dragStart.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            x: rect.left,
            y: rect.top,
          };
          dragged.current = false;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragStart.current) return;
          const deltaX = event.clientX - dragStart.current.pointerX;
          const deltaY = event.clientY - dragStart.current.pointerY;
          if (Math.abs(deltaX) + Math.abs(deltaY) > 4) dragged.current = true;
          if (!dragged.current) return;
          const width = event.currentTarget.getBoundingClientRect().width;
          const height = event.currentTarget.getBoundingClientRect().height;
          setSelectionHelpPosition({
            x: Math.max(8, Math.min(window.innerWidth - width - 8, dragStart.current.x + deltaX)),
            y: Math.max(8, Math.min(window.innerHeight - height - 8, dragStart.current.y + deltaY)),
          });
        }}
        onPointerUp={() => { dragStart.current = null; }}
        onPointerCancel={() => { dragStart.current = null; }}
        style={selectionHelpPosition ? { left: selectionHelpPosition.x, top: selectionHelpPosition.y } : undefined}
      >
        <button
          aria-controls={selectionHelpId}
          aria-expanded={selectionHelpOpen}
          className="daily-word__selection-help-trigger"
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setSelectionHelpOpen(false);
          }}
          onPointerDown={() => { pointerIntent.current = true; }}
          onPointerUp={() => { pointerIntent.current = false; }}
          onPointerCancel={() => { pointerIntent.current = false; }}
          onFocus={() => { if (!pointerIntent.current) setSelectionHelpOpen(true); }}
          onClick={(event) => {
            if (dragged.current) {
              event.preventDefault();
              dragged.current = false;
              return;
            }
            setSelectionHelpOpen(true);
          }}
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            const rect = event.currentTarget.parentElement!.getBoundingClientRect();
            const step = event.shiftKey ? 40 : 12;
            const x = selectionHelpPosition?.x ?? rect.left;
            const y = selectionHelpPosition?.y ?? rect.top;
            setSelectionHelpPosition({
              x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))),
              y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))),
            });
          }}
          type="button"
        >
          <span aria-hidden="true" className="daily-word__selection-help-grip">⠿</span>
          {t('dailyWord.selectionHelp')}
        </button>
        {selectionHelpOpen && (
          <div className="daily-word__selection-help-content" id={selectionHelpId}>
            <p>{t('dailyWord.selectionHelpBody')}</p>
            <button className="daily-word__selection-help-close" onClick={() => setSelectionHelpOpen(false)} type="button">
              {t('dailyWord.selectionHelpClose')}
            </button>
          </div>
        )}
      </aside>,
      document.body,
    )
    : null;
  return (
    <section className="daily-word" aria-labelledby="daily-word-heading" aria-busy={status === 'loading'}>
      <header className="daily-word__heading">
        <h2 id="daily-word-heading">
          <span className="daily-word__title">{t('dailyWord.heading')}</span>
          <time dateTime={date}>{formatIsoDate(date, lang)}</time>
        </h2>
      </header>

      {status === 'loading' && <p role="status">{t('dailyWord.loading')}</p>}
      {status === 'unavailable' && <p className="daily-word__notice" role="status">{t('dailyWord.unavailable')}</p>}
      {status === 'error' && (
        <div className="daily-word__notice daily-word__notice--error" role="alert">
          <p>{t('dailyWord.error')}</p>
          {onRetry && <button className="btn" type="button" onClick={onRetry}>{t('qt.retry')}</button>}
        </div>
      )}
      {status === 'ready' && content && (
        <>
          <ul className="daily-word__cards">
            <li><VerseCard entry={content.oldTestament} testament="old" /></li>
            <li><VerseCard entry={content.newTestament} testament="new" /></li>
          </ul>
        </>
      )}

      <section className="daily-word__providers" aria-labelledby="daily-word-providers-heading">
        <h3 id="daily-word-providers-heading"><ScriptureIcon name="books" />{t('dailyWord.providersHeading')}</h3>
        <p>{t('dailyWord.providersIntro')}</p>
        <ul>
          {links.map((link) => {
            const iconName: ScriptureIconName = link.providerId === 'maeil-seongyeong'
              ? 'leaf'
              : link.providerId === 'saengmyeong-ui-sam' ? 'seedling' : 'waves';
            return (
              <li key={link.providerId}>
                <ExternalLinkButton
                  href={link.url}
                  label={link.providerName[lang]}
                  icon={<ScriptureIcon name={iconName} />}
                  className={`daily-word__provider-button daily-word__provider-button--${link.providerId}`}
                />
              </li>
            );
          })}
        </ul>
      </section>
      {selectionHelp}
    </section>
  );
}
