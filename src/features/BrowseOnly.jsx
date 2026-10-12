import Button from '../components/common/Button';
import EmptyState from '../components/feedback/EmptyState';
import Icon from '../components/feedback/Icon';
import { useAuth } from '../context/AuthContext';
import { BROWSE_COPY } from '../utils/access';

/**
 * A blurred stand-in for a price, for browse-only sessions (see utils/access.js).
 *
 * The digits are a PLACEHOLDER, not the real amount behind a filter — the real
 * price is never rendered for a locked account.
 */
export function LockedPrice({ size = 'var(--fs-md)' }) {
  return (
    <span
      className="row gap-1"
      style={{ alignItems: 'center', fontSize: size }}
      aria-label="Price available after vendor verification"
      title="Price available after vendor verification"
    >
      <span
        aria-hidden="true"
        style={{ fontWeight: 800, filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}
      >
        ₹0,000.00
      </span>
      <Icon name="shield" size={14} />
    </span>
  );
}

/** The call to action shown in place of "Add to cart". */
export function BrowseOnlyAction({ block = true, size }) {
  const { browseStatus } = useAuth();
  const copy = BROWSE_COPY[browseStatus];
  if (!copy) return null;

  return copy.to ? (
    <Button variant="primary" block={block} size={size} icon="shield" to={copy.to}>
      {copy.cta}
    </Button>
  ) : (
    <Button variant="soft" block={block} size={size} icon="clock" disabled>
      Registration under review
    </Button>
  );
}

/** Thin banner under the storefront header while the session is browse-only. */
export function BrowseOnlyBanner() {
  const { browseStatus } = useAuth();
  const copy = BROWSE_COPY[browseStatus];
  if (!copy) return null;

  return (
    <div
      role="status"
      style={{
        background: 'var(--brand-050)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
      }}
    >
      <div
        className="row gap-3 wrap"
        style={{ maxWidth: 1240, margin: '0 auto', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span className="row gap-2" style={{ alignItems: 'center', fontSize: 'var(--fs-sm)' }}>
          <Icon name="shield" size={16} />
          <span><strong>{copy.title}.</strong> {copy.text}</span>
        </span>
        <BrowseOnlyAction block={false} size="sm" />
      </div>
    </div>
  );
}

/**
 * Route guard for storefront pages that need a real buyer account (cart,
 * checkout, orders, saved, addresses, notifications, profile). A browse-only
 * session sees the way forward instead of a page whose every call would 403.
 */
export function RequireBuyer({ children }) {
  const { browseStatus } = useAuth();
  const copy = BROWSE_COPY[browseStatus];
  if (!copy) return children;

  return (
    <EmptyState
      icon="shield"
      title={copy.title}
      text={copy.text}
      action={(
        <div className="row gap-2 wrap" style={{ justifyContent: 'center' }}>
          <BrowseOnlyAction block={false} />
          <Button variant="secondary" icon="home" to="/shop">Browse products</Button>
        </div>
      )}
    />
  );
}
