import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import Segmented from '../../components/common/Segmented';
import Field from '../../components/forms/Field';
import Icon from '../../components/feedback/Icon';
import OtpInput from './OtpInput';
import { useAuth } from '../../context/AuthContext';
import { OTP_LENGTH, OTP_RESEND_SECONDS, requestLoginOtp } from '../../services/authService';
import { homeForRole } from '../../constants/roles';

/**
 * Two ways in, matching the app's sign-in screen:
 *
 *   • Email OTP — POST /eotp mails a code, POST /eotp-verify signs in. Works
 *     for every role, including outlets, because the server looks the address
 *     up in both collections.
 *   • Password — the mobile-number cascade: /login, then /agent-login, then
 *     /outlet-login.
 *
 * There is no role picker: the ACCOUNT decides which portal you land in
 * (homeForRole).
 */
const MODES = [
  { key: 'otp', label: <><Icon name="mail" size={15} /> Email OTP</> },
  { key: 'password', label: <><Icon name="shield" size={15} /> Password</> },
];

const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v).trim());

export default function LoginPage() {
  const { signIn, signInWithOtp, session, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('otp');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Password mode.
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  // Email OTP mode.
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!booting && session) {
    return <Navigate to={location.state?.from || homeForRole(session.role)} replace />;
  }

  const finish = (next) => navigate(location.state?.from || homeForRole(next.role), { replace: true });

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setOtpSent(false);
    setOtp(Array(OTP_LENGTH).fill(''));
  };

  // --- Password ---------------------------------------------------------------
  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      finish(await signIn({ mobile, password }));
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // --- Email OTP ----------------------------------------------------------------
  const sendOtp = async (e) => {
    e?.preventDefault();
    if (!isEmail(email)) { setError('Enter the email address registered with your account.'); return; }
    setBusy(true); setError(null);
    try {
      await requestLoginOtp(email);
      setOtpSent(true);
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(OTP_RESEND_SECONDS);
      setTimeout(() => otpRef.current?.focus(), 0);
    } catch (err) {
      setError(err.message || 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;
    setBusy(true); setError(null);
    try {
      finish(await signInWithOtp({ email, otp: code }));
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      setOtp(Array(OTP_LENGTH).fill(''));
      otpRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const otpComplete = otp.every(Boolean);

  return (
    <div className="auth__form">
      <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Welcome back</h1>
      <p className="page__sub" style={{ marginBottom: 'var(--sp-5)' }}>
        Sign in with the email or mobile number registered with VS Arogya. Your account decides which portal you land in.
      </p>

      <Segmented className="segmented--fill" options={MODES} value={mode} onChange={switchMode} />

      <div style={{ height: 'var(--sp-5)' }} />

      {error && <Note tone="danger" className="section">{error}</Note>}

      {/* --- Email OTP ------------------------------------------------------ */}
      {mode === 'otp' && !otpSent && (
        <form className="stack gap-4" onSubmit={sendOtp}>
          <Field label="Email address" required htmlFor="email">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--brand-600)' }}>
                <Icon name="mail" size={16} />
              </span>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@pharmacy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: 38 }}
                required
              />
            </div>
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy} iconRight="arrowRight">
            Send code
          </Button>
        </form>
      )}

      {mode === 'otp' && otpSent && (
        <form className="stack gap-4" onSubmit={verifyOtp}>
          <Note tone="success" icon="check">
            If an account exists for <strong>{email}</strong>, a code is on its way.{' '}
            <button
              type="button"
              onClick={() => { setOtpSent(false); setError(null); }}
              style={{ fontWeight: 700, color: 'var(--brand-800)', textDecoration: 'underline' }}
            >
              Change email
            </button>
          </Note>

          <Field label={`Enter the ${OTP_LENGTH}-digit code`} required hint="The code expires in 10 minutes.">
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

          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!otpComplete}>
            Verify &amp; sign in
          </Button>
        </form>
      )}

      {/* --- Password ------------------------------------------------------- */}
      {mode === 'password' && (
        <form className="stack gap-4" onSubmit={submitPassword}>
          <Field label="Mobile number" required htmlFor="mobile">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--brand-600)' }}>
                <Icon name="phone" size={16} />
              </span>
              <input
                id="mobile"
                className="input"
                inputMode="numeric"
                autoComplete="username"
                placeholder="10-digit number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                style={{ paddingLeft: 38 }}
                required
              />
            </div>
          </Field>

          <Field label="Password" required htmlFor="password">
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 40 }}
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 10, top: 9, color: 'var(--text-subtle)' }}
              >
                <Icon name="eye" size={16} />
              </button>
            </div>
          </Field>

          <div className="between">
            <Link to="/forgot-password" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--brand-700)' }}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" size="lg" block loading={busy}>Sign in</Button>
        </form>
      )}

      <p className="text-center muted" style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--fs-sm)' }}>
        New pharmacy or clinic?{' '}
        <Link to="/register" style={{ fontWeight: 700, color: 'var(--brand-700)' }}>Register as a vendor</Link>
      </p>
    </div>
  );
}
