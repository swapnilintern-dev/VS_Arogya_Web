import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../feedback/Icon';
import cn from '../../utils/cn';

/** size: sm (default 560px) | lg (780) | xl (1040) */
export default function Modal({ title, sub, children, footer, onClose, size = 'sm', className }) {
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
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={cn('modal', size !== 'sm' && `modal--${size}`, className)} role="dialog" aria-modal="true" aria-label={title}>
        {(title || onClose) && (
          <header className="modal__head">
            <div className="grow">
              {title && <h2 className="modal__title">{title}</h2>}
              {sub && <p className="modal__sub">{sub}</p>}
            </div>
            {onClose && (
              <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            )}
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
