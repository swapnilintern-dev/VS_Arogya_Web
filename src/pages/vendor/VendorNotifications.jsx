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
import { listInbox, markRead, markAllRead, deleteInboxItem } from '../../services/notificationService';
import { NOTIFICATION_CATEGORY_COLOR } from '../../constants/catalog';
import { timeAgo } from '../../utils/dates';

const REDIRECT_TO = {
  home: '/shop',
  products: '/shop/products',
  offers: '/shop/products',
  orders: '/shop/orders',
  cart: '/shop/cart',
  saved: '/shop/saved',
  profile: '/shop/profile',
};

/** The vendor's notification centre — the receiving end of marketing broadcasts. */
export default function VendorNotifications() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(listInbox, []);

  const unread = (data || []).filter((n) => !n.read).length;
  const pinned = (data || []).filter((n) => n.pinned);
  const rest = (data || []).filter((n) => !n.pinned);

  const open = async (n) => {
    if (!n.read) setData(await markRead(n._id));
  };

  const remove = async (n) => {
    setData(await deleteInboxItem(n._id));
    toast.success('Notification removed.');
  };

  const card = (n) => {
    const accent = NOTIFICATION_CATEGORY_COLOR[n.category] || 'var(--brand-700)';
    return (
      <Card key={n._id} style={{ borderLeft: `3px solid ${accent}` }}>
        <CardBody className="stack gap-3">
          <div className="between">
            <span className="row gap-2 wrap">
              <span className="badge" style={{ background: `${accent}1a`, color: accent }}>{n.category}</span>
              {n.pinned && <Badge tone="accent">Pinned</Badge>}
              {!n.read && <Badge tone="info" dot>New</Badge>}
              {n.priority === 'Critical' && <Badge tone="danger">Critical</Badge>}
            </span>
            <span className="row gap-2">
              <span className="subtle nowrap" style={{ fontSize: 'var(--fs-xs)' }}>{timeAgo(n.sentAt)}</span>
              <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(n)} aria-label="Remove" />
            </span>
          </div>

          <div>
            <p style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>{n.title}</p>
            {n.subtitle && <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{n.subtitle}</p>}
            <p style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.6 }}>{n.message}</p>
          </div>

          <div className="row gap-2">
            {n.buttonText && REDIRECT_TO[n.redirectScreen] && (
              <Button size="sm" variant="soft" iconRight="arrowRight" to={REDIRECT_TO[n.redirectScreen]}
                onClick={() => open(n)}>
                {n.buttonText}
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
              <Button variant="secondary" icon="check" onClick={async () => { setData(await markAllRead()); }}>
                Mark all read
              </Button>
            )}
          </>
        )}
      />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <div className="stack gap-3"><CardSkeleton count={3} /></div>}

      {!loading && !error && data?.length === 0 && (
        <Card>
          <EmptyState
            icon="bell"
            title="No notifications"
            text="Stock updates, new medicines and offers from the VS Arogya team land here."
          />
        </Card>
      )}

      {!loading && !error && data?.length > 0 && (
        <div className="stack gap-3" style={{ maxWidth: 820 }}>
          {pinned.map(card)}
          {pinned.length > 0 && rest.length > 0 && <hr className="divider" />}
          {rest.map(card)}
        </div>
      )}
    </>
  );
}
