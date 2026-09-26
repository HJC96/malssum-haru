import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { bookName, useI18n } from '@/i18n';

interface Props {
  bookIds: string[];
  onReorder: (bookIds: string[]) => void;
  onRemove: (bookId: string) => void;
}

const reorder = (ids: string[], from: number, to: number) => {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length || from === to) return ids;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
};

/** Pointer drag works for mouse/touch; Space/Enter + arrows provides a keyboard equivalent. */
export function BookOrderList({ bookIds, onReorder, onRemove }: Props) {
  const { lang, t } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);
  const [keyboardOrder, setKeyboardOrder] = useState<string[] | null>(null);
  const [activeBook, setActiveBook] = useState<string | null>(null);
  const [pointerDrag, setPointerDrag] = useState<{ id: string; target: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const shownIds = pointerDrag ? reorder(bookIds, bookIds.indexOf(pointerDrag.id), pointerDrag.target) : keyboardOrder ?? bookIds;
  const announcePosition = (id: string, order: string[]) => {
    setAnnouncement(t('plan.books.moved', { book: bookName(id, lang), position: order.indexOf(id) + 1, total: order.length }));
  };

  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (activeBook === id && keyboardOrder) {
        onReorder(keyboardOrder);
        announcePosition(id, keyboardOrder);
        setKeyboardOrder(null);
        setActiveBook(null);
      } else {
        setKeyboardOrder([...bookIds]);
        setActiveBook(id);
      }
      return;
    }
    if (event.key === 'Escape' && activeBook === id) {
      event.preventDefault();
      setKeyboardOrder(null);
      setActiveBook(null);
      setAnnouncement(t('plan.books.reorderCancelled'));
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && activeBook === id && keyboardOrder) {
      event.preventDefault();
      const from = keyboardOrder.indexOf(id);
      const next = reorder(keyboardOrder, from, from + (event.key === 'ArrowUp' ? -1 : 1));
      setKeyboardOrder(next);
      announcePosition(id, next);
    }
  };

  const pointerStart = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerDrag({ id, target: bookIds.indexOf(id) });
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerDrag || event.pointerId !== (event.currentTarget.hasPointerCapture(event.pointerId) ? event.pointerId : -1)) return;
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-book-order-index]') ?? [])];
    const y = event.clientY;
    const match = items.find((el) => {
      const rect = el.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    const target = match ? Number(match.dataset.bookOrderIndex) : Math.max(0, items.length - 1);
    setPointerDrag({ ...pointerDrag, target });
  };
  const pointerFinish = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerDrag) return;
    const final = reorder(bookIds, bookIds.indexOf(pointerDrag.id), pointerDrag.target);
    if (final !== bookIds) onReorder(final);
    announcePosition(pointerDrag.id, final);
    setPointerDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="book-order">
      <p className="qt-note">{t('plan.books.reorderHint')}</p>
      {bookIds.length === 0 ? (
        <p className="qt-note">{t('plan.books.none')}</p>
      ) : (
        <ol className="order-list" ref={listRef}>
          {shownIds.map((id, i) => (
            <li
              key={id}
              data-book-order-index={i}
              className={pointerDrag?.id === id ? 'order-list__item order-list__item--dragging' : 'order-list__item'}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const fromId = event.dataTransfer.getData('text/plain');
                const next = reorder(bookIds, bookIds.indexOf(fromId), i);
                onReorder(next);
                announcePosition(fromId, next);
              }}
            >
              <button
                type="button"
                className="book-order__handle"
                draggable
                aria-label={t('plan.books.dragHandle', { book: bookName(id, lang) })}
                aria-pressed={activeBook === id}
                onKeyDown={(event) => keyboard(event, id)}
                onPointerDown={(event) => pointerStart(event, id)}
                onPointerMove={pointerMove}
                onPointerUp={pointerFinish}
                onPointerCancel={() => setPointerDrag(null)}
              >
                <span aria-hidden="true">⠿</span><span className="visually-hidden">{i + 1}</span>
              </button>
              <span>{bookName(id, lang)}</span>
              <button type="button" className="btn btn--small" onClick={() => onRemove(id)}>
                {t('plan.books.remove', { book: bookName(id, lang) })}
              </button>
            </li>
          ))}
        </ol>
      )}
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  );
}
