import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import EmptyState from '../../components/feedback/EmptyState';
import Icon from '../../components/feedback/Icon';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import ExpiryBadge from '../../features/ExpiryBadge';
import ProductThumb from '../../features/ProductThumb';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { listOutletStock, listOutletOrders, getOutletProfile, listOutletLots } from '../../services/outletService';
import { currency, number } from '../../utils/format';
import { timeAgo } from '../../utils/dates';
import { expiryTierOf, EXPIRY_TIER } from '../../utils/expiry';

const QUICK = [
  ['receipt', 'Start a bill', 'Serve a walk-in customer at the counter', '/outlet/billing'],
  ['plus', 'Manual order', 'Order for a registered vendor from your stock', '/outlet/orders/new'],
  ['layers', 'Check stock', 'What you hold, lot by lot', '/outlet/stock'],
];

/** The counter's home: what you hold, what you owe, what to sell first. */
export default function OutletDashboard() {
  const { session, outletId } = useAuth();
  const stock = useAsync(() => listOutletStock(outletId), [outletId]);
  const orders = useAsync(() => listOutletOrders(outletId), [outletId]);
  const profile = useAsync(() => getOutletProfile(outletId), [outletId]);
  const lots = useAsync(() => listOutletLots(outletId), [outletId]);

  const stats = useMemo(() => {
    const rows = stock.data || [];
    const list = orders.data || [];
    return {
      skus: rows.length,
      units: rows.reduce((s, r) => s + r.quantity, 0),
      outOf: rows.filter((r) => r.quantity === 0).length,
      orders: list.length,
      value: list.reduce((s, o) => s + o.totalAmount, 0),
      recent: list.slice(0, 6),
    };
  }, [stock.data, orders.data]);

  // Lots this outlet holds that are expiring or expired — the thing a counter
  // most needs to act on, because expired stock cannot legally be sold.
  const expiring = useMemo(() => (lots.data || [])
    .filter((b) => b.available_quantity > 0)
    .map((b) => ({ ...b, tier: expiryTierOf(b.expiry_date), product: b.productDoc }))
    .filter((b) => [EXPIRY_TIER.EXPIRED, EXPIRY_TIER.CRITICAL, EXPIRY_TIER.WARNING].includes(b.tier))
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .slice(0, 6), [lots.data]);

  return (
    <>
      <PageHeader
        title={profile.data?.outletName || session?.name || 'Outlet'}
        sub={profile.data ? `${profile.data.address}, ${profile.data.city} — ${profile.data.pincode}` : 'Counter operations'}
        actions={(
          <>
            <Button icon="refresh" onClick={() => { stock.reload(); orders.reload(); }}>Refresh</Button>
            <Button variant="primary" icon="receipt" to="/outlet/billing">Start a bill</Button>
          </>
        )}
      />

      <div className="grid grid--kpi section stagger">
        {stock.loading ? <CardSkeleton count={4} /> : (
          <>
            <StatTile label="Medicines held" value={number(stats.skus)} icon="pill"
              foot={`${number(stats.units)} units in total`} to="/outlet/stock" />
            <StatTile label="Out of stock" value={number(stats.outOf)} icon="alert"
              tone={stats.outOf ? 'warning' : undefined}
              foot="Assigned but now empty" to="/outlet/stock" />
            <StatTile label="Orders placed" value={number(stats.orders)} icon="receipt" tone="info"
              foot="From this counter" to="/outlet/orders" />
            <StatTile label="Order value" value={currency(stats.value)} icon="rupee" foot="Lifetime" />
          </>
        )}
      </div>

      <section className="section">
        <div className="section__head"><h2 className="section__title">Quick actions</h2></div>
        <div className="grid grid--3">
          {QUICK.map(([icon, title, text, to]) => (
            <Link to={to} key={to} className="card card--pad row gap-3" style={{ alignItems: 'flex-start' }}>
              <span className="stat__icon"><Icon name={icon} size={15} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{title}</span>
                <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-xs)', marginTop: 2 }}>{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="split">
        <Card>
          <CardHead
            title="Recent orders"
            actions={<Button size="sm" variant="ghost" iconRight="arrowRight" to="/outlet/orders">View all</Button>}
          />
          {orders.loading ? <CardBody><CardSkeleton count={3} /></CardBody>
            : stats.recent.length === 0 ? (
              <EmptyState
                icon="receipt"
                title="No orders yet"
                text="Bills and manual orders placed from this counter appear here."
                action={<Button variant="primary" to="/outlet/billing">Start a bill</Button>}
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th className="cell-num">Amount</th><th>Status</th><th>Placed</th></tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <Link to={`/outlet/orders/${o._id}`} className="mono" style={{ fontWeight: 700, color: 'var(--brand-700)' }}>
                            {o.orderNo}
                          </Link>
                        </td>
                        <td className="truncate">{o.user.store_name}</td>
                        <td className="cell-num">{currency(o.totalAmount)}</td>
                        <td><OrderStatusBadge status={o.orderStatus} /></td>
                        <td className="subtle nowrap">{timeAgo(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Sell these first" sub="Your lots nearest to expiry" />
            <CardBody className="stack gap-3">
              {lots.loading && <CardSkeleton count={2} />}
              {!lots.loading && expiring.length === 0 && (
                <p className="subtle">No lot on your shelf expires within 90 days.</p>
              )}
              {expiring.map((b) => (
                <Link to={`/outlet/stock/${b.product?._id}`} key={b._id} className="row gap-3">
                  <ProductThumb product={b.product} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>
                      {b.product?.title || 'Medicine'}
                    </span>
                    <span className="row gap-2" style={{ marginTop: 2 }}>
                      <span className="mono subtle" style={{ fontSize: 'var(--fs-xs)' }}>{b.batch_number}</span>
                      <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{number(b.available_quantity)} units</span>
                    </span>
                  </span>
                  <ExpiryBadge date={b.expiry_date} dense />
                </Link>
              ))}
              {expiring.some((b) => b.tier === EXPIRY_TIER.EXPIRED) && (
                <Badge tone="danger" dot>Expired lots cannot be billed</Badge>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="This outlet" />
            <CardBody className="stack gap-2">
              {profile.loading ? <CardSkeleton count={1} /> : (
                <>
                  <p style={{ fontWeight: 700 }}>{profile.data?.outletName}</p>
                  <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{profile.data?.ownerName}</p>
                  <p className="subtle mono" style={{ fontSize: 'var(--fs-sm)' }}>{profile.data?.mobileNo}</p>
                  <Badge tone={profile.data?.status === 'Active' ? 'success' : 'muted'} dot>
                    {profile.data?.status}
                  </Badge>
                  <Button size="sm" variant="secondary" block to="/outlet/profile">Open profile</Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
