import { useState } from 'react';
import { Card, CardHead, CardBody } from '../components/common/Card';
import Button from '../components/common/Button';
import Note from '../components/common/Note';
import Field from '../components/forms/Field';
import Icon from '../components/feedback/Icon';
import { useToast } from '../context/ToastContext';
import { updatePassword } from '../services/authService';

/**
 * Change password — PUT /update-password with the current one.
 *
 * The same endpoint also serves forgot-password, which proves ownership by
 * email OTP instead and sends no `currentPassword`; see ForgotPasswordPage.
 *
 * Shown on every role's profile, so it is a feature rather than a page.
 */
const MIN_PASSWORD = 6;

export default function ChangePasswordCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setShow(false);
  };

  const close = () => { setOpen(false); reset(); };

  const mismatch = !!confirm && confirm !== next;
  const tooShort = !!next && next.length < MIN_PASSWORD;
  const sameAsOld = !!next && next === current;
  const canSubmit = current && next.length >= MIN_PASSWORD && next === confirm && !sameAsOld && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError(null);
    try {
      await updatePassword({ newPassword: next, currentPassword: current });
      toast.success('Password updated.');
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      aria-label={show ? 'Hide passwords' : 'Show passwords'}
      style={{ position: 'absolute', right: 10, top: 9, color: 'var(--text-subtle)' }}
    >
      <Icon name="eye" size={16} />
    </button>
  );

  return (
    <Card>
      <CardHead
        title="Password"
        sub="Change the password you sign in with."
        actions={open
          ? <Button size="sm" variant="ghost" onClick={close}>Cancel</Button>
          : <Button size="sm" variant="secondary" icon="shield" onClick={() => setOpen(true)}>Change</Button>}
      />
      {open && (
        <CardBody>
          <form className="stack gap-4" onSubmit={submit}>
            {error && <Note tone="danger">{error}</Note>}

            <Field label="Current password" required>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  style={{ paddingRight: 40 }}
                  required
                />
                {eye}
              </div>
            </Field>

            <Field
              label="New password"
              required
              hint={`At least ${MIN_PASSWORD} characters`}
              error={tooShort ? `Use at least ${MIN_PASSWORD} characters` : sameAsOld ? 'Choose a password different from the current one' : undefined}
            >
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </Field>

            <Field label="Confirm new password" required error={mismatch ? 'Passwords do not match' : undefined}>
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>

            <Button type="submit" variant="primary" block icon="check" loading={busy} disabled={!canSubmit}>
              Update password
            </Button>
          </form>
        </CardBody>
      )}
    </Card>
  );
}
