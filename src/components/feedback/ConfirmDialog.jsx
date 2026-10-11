import Modal from '../common/Modal';
import Button from '../common/Button';

/**
 * Destructive-action confirmation. Reached through the useConfirm() hook so no
 * page has to hold dialog state of its own.
 */
export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
  busy = false,
}) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      {message && <p style={{ color: 'var(--text-muted)' }}>{message}</p>}
      <div className="modal__foot" style={{ margin: 'var(--sp-5) calc(var(--sp-5) * -1) calc(var(--sp-5) * -1)' }}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
