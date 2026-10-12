import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import Icon from '../components/feedback/Icon';
import { useAuth } from '../context/AuthContext';
import { APPROVAL } from '../constants/roles';

/**
 * What a guest sees across the top of the storefront.
 *
 * Email OTP signs in ANY address. If there is no vendor record, or one that is
 * still Pending or Rejected, the server issues a "guest" token with no account
 * id and refuses it on every protected route — so the catalogue is readable
 * and nothing else is. This strip says why prices are missing and what to do
 * about it, which differs by how far their registration has got.
 */
const COPY = {
  [APPROVAL.NOT_REGISTERED]: {
    tone: 'info',
    icon: 'store',
    title: 'You are browsing as a guest',
    body: 'Register your pharmacy, clinic or hospital to see distributor prices and place orders.',
    cta: { label: 'Register as a vendor', to: '/register' },
  },
  [APPROVAL.PENDING]: {
    tone: 'warning',
    icon: 'clock',
    title: 'Your registration is under review',
    body: 'Our team is verifying your documents. You will get an email once it is approved — then sign in again with your email OTP to see prices and order.',
    cta: null,
  },
  [APPROVAL.REJECTED]: {
    tone: 'danger',
    icon: 'alert',
    title: 'Your registration was not approved',
    body: 'Please contact VS Arogya support to find out what is needed and to apply again.',
    cta: { label: 'Register again', to: '/register' },
  },
};

const TONE_STYLE = {
  info: { bg: 'var(--info-bg)', fg: '#1e40af', border: '#cfe0fd' },
  warning: { bg: 'var(--warning-bg)', fg: '#92400e', border: '#f6ddc0' },
  danger: { bg: 'var(--danger-bg)', fg: '#991b1b', border: '#f7cfcb' },
};

export default function GuestBanner() {
  const { isGuest, approvalStatus } = useAuth();
  if (!isGuest) return null;

  const copy = COPY[approvalStatus] || COPY[APPROVAL.NOT_REGISTERED];
  const tone = TONE_STYLE[copy.tone];

  return (
    <div
      className="section"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        flexWrap: 'wrap',
        padding: 'var(--sp-4) var(--sp-5)',
        borderRadius: 'var(--r-lg)',
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
      }}
    >
      <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,.6)' }}>
        <Icon name={copy.icon} size={17} />
      </span>

      <div className="grow" style={{ minWidth: 220 }}>
        <p style={{ fontWeight: 700 }}>{copy.title}</p>
        <p style={{ fontSize: 'var(--fs-sm)', opacity: 0.9 }}>{copy.body}</p>
      </div>

      {copy.cta && (
        <Button variant="primary" icon="arrowRight" to={copy.cta.to}>{copy.cta.label}</Button>
      )}

      <Link to="/login" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'inherit', textDecoration: 'underline' }}>
        Sign in to another account
      </Link>
    </div>
  );
}
