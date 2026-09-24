import { useRef, useState } from 'react';
import { useI18n } from '@/i18n';

/**
 * 데이터 출처·라이선스 고지. 문서(web/src/data/THIRD_PARTY_NOTICES.md)는 열 때만 읽기 전용으로 가져오며(지연 로드),
 * 텍스트로만 표시한다.
 */
export function NoticesButton() {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const open = async () => {
    if (text === null) {
      try {
        const mod = await import('@/data/THIRD_PARTY_NOTICES.md?raw');
        setText(mod.default);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    }
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  };

  const close = () => {
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
  };

  return (
    <>
      <button type="button" className="btn btn--small" onClick={() => void open()}>
        {t('app.notices.open')}
      </button>
      <dialog ref={dialogRef} className="notices" aria-labelledby="notices-title" onClose={() => undefined}>
        <h2 id="notices-title">{t('app.notices.title')}</h2>
        <p className="qt-note">{t('app.notices.intro')}</p>
        {failed ? <p role="alert">{t('app.notices.loadError')}</p> : <pre className="notices__text">{text}</pre>}
        <button type="button" className="btn" onClick={close}>
          {t('app.notices.close')}
        </button>
      </dialog>
    </>
  );
}
