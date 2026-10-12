import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import Field from '../../components/forms/Field';
import Icon from '../../components/feedback/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  OTP_LENGTH, OTP_RESEND_SECONDS, requestLoginOtp, resetPasswordWithOtp,
} from '../../services/authService';
import { homeForRole } from '../../constants/roles';
import OtpInput from './OtpInput';

/**
 * Email → code → new password.
 *
 * The code proves the address (POST /eotp + /eotp-verify), which also signs the
 * account in; PUT /update-password then sets the new password with that
 * session — which is why no current password is asked for. On success the user
 * is already signed in, so they land on their portal rather than back at login.
 */
const MIN_PASSWORD = 6;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { adoptSession } = useAuth();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter the email address registered with your account.'); return; }
    setBusy(true); setError(null);
    try {
      await requestLoginOtp(email);
      setCooldown(OTP_RESEND_SECONDS);
      setStep(1);
      setTimeout(() => otpRef.current?.focus(), 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const session = await resetPasswordWithOtp({ email, otp: otp.join(''), newPassword: password });
      adoptSession(session);
      toast.success('Password updated — you are signed in.');
      navigate(homeForRole(session.role), { replace: true });
    } catch (err) {
      setError(err.message);
      // A bad code is rejected at the verify step; let them retype it.
      if (!/password/i.test(err.message || '')) {
        setOtp(Array(OTP_LENGTH).fill(''));
        otpRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  const otpComplete = otp.every(Boolean);
  const passwordsOk = password.length >= MIN_PASSWORD && password === confirm;

  return (
    <div className="auth__form">
      <Link to="/login" className="btn btn--ghost btn--sm" style={{ marginBottom: 'var(--sp-4)' }}>
        <Icon name="arrowLeft" size={14} /> Back to sign in
      </Link>

      <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Reset password</h1>
      <p className="page__sub" style={{ marginBottom: 'var(--sp-6)' }}>
        {step === 0
          ? 'Enter the email address registered with your account — we will send you a code.'
          : `Enter the ${OTP_LENGTH}-digit code sent to ${email}, then choose a new password.`}
      </p>

      {error && <Note tone="danger" className="section">{error}</Note>}

      {step === 0 && (
        <form className="stack gap-4" onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
          <Field label="Email address" required htmlFor="email">
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@pharmacy.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy}>Send code</Button>
        </form>
      )}

      {step === 1 && (
        <form className="stack gap-4" onSubmit={(e) => { e.preventDefault(); if (otpComplete && passwordsOk) submit(); }}>
          <Field label="Verification code" required>
            <OtpInput ref={otpRef} value={otp} onChange={setOtp} />
          </Field>

          <div className="between">
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={sendOtp}
              style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: cooldown > 0 ? 'var(--text-subtle)' : 'var(--brand-700)' }}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>

          <Field label="New password" required hint={`At least ${MIN_PASSWORD} characters`}>
            <input className="input" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field
            label="Confirm password"
            required
            error={confirm && confirm !== password ? 'Passwords do not match' : undefined}
          >
            <input className="input" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>

          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!otpComplete || !passwordsOk}>
            Update password
          </Button>
        </form>
      )}
    </div>
  );
}
