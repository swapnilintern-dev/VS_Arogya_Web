import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../feedback/Icon';

/**
 * Right-hand detail drawer — the desktop translation of the app's bottom
 * sheets (admin order detail, batch picker, agent assignment).
 */
export default function Drawer({ title, sub, children, footer, onClose, width }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" style={width ? { width } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <div className="grow">
            {title && <h2 className="modal__title">{title}</h2>}
            {sub && <p className="modal__sub">{sub}</p>}
          </div>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </aside>
    </>,
    document.body,
  );
}
