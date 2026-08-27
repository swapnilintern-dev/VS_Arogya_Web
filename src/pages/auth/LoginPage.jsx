import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import Field from '../../components/forms/Field';
import Icon from '../../components/feedback/Icon';
import DevRoleSwitcher from './DevRoleSwitcher';
import { useAuth } from '../../context/AuthContext';
import { USE_MOCK } from '../../services/http';
import { homeForRole } from '../../constants/roles';

/**
 * One mobile + password form — there is no role picker, exactly as in the app.
 * The ACCOUNT decides the role: authService tries the Vendor collection, then
 * the delivery-agent collection, then the Outlet collection, and the first
 * success routes to that role's portal (homeForRole).
 */
export default function LoginPage() {
  const { signIn, session, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!booting && session) {
    return <Navigate to={location.state?.from || homeForRole(session.role)} replace />;
  }

  const submit = async (credentials) => {
    setBusy(true);
    setError(null);
    try {
      const next = await signIn(credentials);
      navigate(location.state?.from || homeForRole(next.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth__form">
      <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Sign in</h1>
      <p className="page__sub" style={{ marginBottom: 'var(--sp-6)' }}>
        Use the mobile number registered with VS Arogya. Your account decides which portal you land in.
      </p>

      {error && <Note tone="danger" className="section">{error}</Note>}

      <form
        className="stack gap-4"
        onSubmit={(e) => { e.preventDefault(); submit({ mobile, password }); }}
      >
        <Field label="Mobile number" required htmlFor="mobile">
          <input
            id="mobile"
            className="input"
            inputMode="numeric"
            autoComplete="username"
            placeholder="10-digit number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            required
          />
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
              onClick={() => setShow((s) => !s)}
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

      <p className="text-center muted" style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--fs-sm)' }}>
        New pharmacy or clinic?{' '}
        <Link to="/register" style={{ fontWeight: 700, color: 'var(--brand-700)' }}>Register as a vendor</Link>
      </p>

      {USE_MOCK && <DevRoleSwitcher onPick={submit} busy={busy} />}
    </div>
  );
}
