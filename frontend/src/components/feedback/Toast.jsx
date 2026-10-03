import Icon from './Icon';

export default function Toast({ toast, onDismiss }) {
  const icon = toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'alert' : 'info';
  return (
    <div className={`toast toast--${toast.tone || 'info'}`} role="status">
      <Icon name={icon} size={16} />
      <span className="grow">{toast.message}</span>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
