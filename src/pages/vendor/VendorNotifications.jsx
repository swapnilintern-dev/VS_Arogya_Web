import PageHeader from '../../components/common/PageHeader';
import { Card, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import Icon from '../../components/feedback/Icon';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import {
  listNotificationCentre, markCentreItemRead, markCentreAllRead, removeCentreItem,
} from '../../services/notificationService';
import { NOTIFICATION_CATEGORY_COLOR } from '../../constants/catalog';
import { timeAgo } from '../../utils/dates';

/** Where a broadcast's call-to-action goes. */
const REDIRECT_TO = {
  home: '/shop',
  products: '/shop',
  offers: '/shop',
  orders: '/shop/orders',
  cart: '/shop/cart',
  saved: '/shop/saved',
  profile: '/shop/profile',
};

/** A direct message about an order deep-links to it. */
const ORDER_TYPES = ['order', 'delivery', 'payment'];
const linkFor = (n) => {
  if (n.source === 'broadcast') return REDIRECT_TO[n.redirectScreen] || null;
  if (n.referenceId && ORDER_TYPES.some((t) => n.category.includes(t))) return `/shop/orders/${n.referenceId}`;
  return null;
};

/**
 * The vendor's notification centre.
 *
 * Two systems land here: marketing BROADCASTS (campaign receipts, with a
 * category and a sender) and DIRECT messages about this account's own orders
 * and payments. notificationService merges them into one list.
 */
export default function VendorNotifications() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(listNotificationCentre, []);

  const rows = data || [];
  const unread = rows.filter((n) => !n.read).length;
  const pinned = rows.filter((n) => n.pinned);
  const rest = rows.filter((n) => !n.pinned);

  const open = async (n) => {
    if (n.read) return;
    try {
      setData(await markCentreItemRead(n));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (n) => {
    try {
      setData(await removeCentreItem(n));
      toast.success('Notification removed.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markAll = async () => {
    try {
      setData(await markCentreAllRead());
    } catch (err) {
      toast.error(err.message);
    }
  };

  const card = (n) => {
    const accent = NOTIFICATION_CATEGORY_COLOR[n.category]
      || (n.source === 'direct' ? 'var(--info)' : 'var(--brand-700)');
    const to = linkFor(n);
    return (
      <Card key={n.key} style={{ borderLeft: `3px solid ${accent}` }}>
        <CardBody className="stack gap-3">
          <div className="between">
            <span className="row gap-2 wrap">
              <span className="badge" style={{ background: `${accent}1a`, color: accent, textTransform: 'capitalize' }}>
                {n.category}
              </span>
              {n.pinned && <Badge tone="accent">Pinned</Badge>}
              {!n.read && <Badge tone="info" dot>New</Badge>}
              {n.priority === 'Critical' && <Badge tone="danger">Critical</Badge>}
            </span>
            <span className="row gap-2">
              <span className="subtle nowrap" style={{ fontSize: 'var(--fs-xs)' }}>{timeAgo(n.at)}</span>
              {n.deletable && (
                <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(n)} aria-label="Remove" />
              )}
            </span>
          </div>

          <div>
            <p style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>{n.title}</p>
            {n.subtitle && <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{n.subtitle}</p>}
            <p style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.6 }}>{n.message}</p>
          </div>

          <div className="row gap-2">
            {to && (
              <Button size="sm" variant="soft" iconRight="arrowRight" to={to} onClick={() => open(n)}>
                {n.buttonText || 'View'}
              </Button>
            )}
            {!n.read && (
              <Button size="sm" variant="ghost" icon="check" onClick={() => open(n)}>Mark read</Button>
            )}
            <span className="grow" />
            <span className="subtle row gap-1" style={{ fontSize: 'var(--fs-xs)' }}>
              <Icon name="user" size={11} /> {n.senderName}
            </span>
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        sub={unread ? `${unread} unread` : 'You are all caught up.'}
        actions={(
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            {unread > 0 && (
              <Button variant="secondary" icon="check" onClick={markAll}>Mark all read</Button>
            )}
          </>
        )}
      />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <div className="stack gap-3"><CardSkeleton count={3} /></div>}

      {!loading && !error && rows.length === 0 && (
        <Card>
          <EmptyState
            icon="bell"
            title="No notifications"
            text="Order updates, plus stock news and offers from the VS Arogya team, land here."
          />
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="stack gap-3" style={{ maxWidth: 820 }}>
          {pinned.map(card)}
          {pinned.length > 0 && rest.length > 0 && <hr className="divider" />}
          {rest.map(card)}
        </div>
      )}
    </>
  );
}
