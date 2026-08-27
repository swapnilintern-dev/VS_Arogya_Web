import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import Field from '../../components/forms/Field';
import Icon from '../../components/feedback/Icon';
import { requestPasswordOtp, verifyPasswordOtp } from '../../services/authService';

/**
 * Mobile → OTP → new password → done, matching lib/auth/forgot_password_screen.dart.
 *
 * The flow is complete UI. The SERVER has no send-OTP / verify-OTP route
 * (analysis §9.6), so authService throws NotImplementedError and this page says
 * so plainly instead of pretending a code was sent.
 */
const MIN_PASSWORD = 6;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) { setError('Enter a 10-digit mobile number.'); return; }
    setBusy(true); setError(null);
    try {
      await requestPasswordOtp(mobile);
      setCooldown(30);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true); setError(null);
    try {
      await verifyPasswordOtp(mobile, otp.join(''));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth__form">
      <Link to="/login" className="btn btn--ghost btn--sm" style={{ marginBottom: 'var(--sp-4)' }}>
        <Icon name="arrowLeft" size={14} /> Back to sign in
      </Link>

      <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Reset password</h1>
      <p className="page__sub" style={{ marginBottom: 'var(--sp-6)' }}>
        {step === 0 && 'Enter the mobile number registered with your account.'}
        {step === 1 && `Enter the 6-digit code sent to ${mobile}.`}
        {step === 2 && 'Choose a new password for your account.'}
      </p>

      {error && <Note tone={error.includes('no backend endpoint') ? 'warning' : 'danger'} className="section">{error}</Note>}

      {step === 0 && (
        <div className="stack gap-4">
          <Field label="Mobile number" required>
            <input
              className="input"
              inputMode="numeric"
              placeholder="10-digit number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </Field>
          <Button variant="primary" size="lg" block loading={busy} onClick={sendOtp}>Send code</Button>
        </div>
      )}

      {step === 1 && (
        <div className="stack gap-4">
          <Field label="Verification code" required>
            <div className="row gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  className="input text-center"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  style={{ width: 46, fontSize: 'var(--fs-lg)', fontWeight: 700 }}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 1);
                    setOtp((o) => o.map((d, j) => (j === i ? v : d)));
                    if (v && i < 5) e.target.nextElementSibling?.focus();
                  }}
                />
              ))}
            </div>
          </Field>
          <div className="between">
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={sendOtp}
              style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: cooldown > 0 ? 'var(--text-subtle)' : 'var(--brand-700)' }}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
          <Button variant="primary" size="lg" block loading={busy}
            disabled={otp.some((d) => !d)} onClick={verify}>
            Verify
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="stack gap-4">
          <Field label="New password" required hint={`At least ${MIN_PASSWORD} characters`}>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field
            label="Confirm password"
            required
            error={confirm && confirm !== password ? 'Passwords do not match' : undefined}
          >
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button
            variant="primary"
            size="lg"
            block
            disabled={password.length < MIN_PASSWORD || password !== confirm}
            onClick={() => navigate('/login', { replace: true })}
          >
            Update password
          </Button>
        </div>
      )}
    </div>
  );
}
