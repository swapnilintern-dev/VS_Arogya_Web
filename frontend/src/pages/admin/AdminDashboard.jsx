import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Button from '../../components/common/Button';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import EmptyState from '../../components/feedback/EmptyState';
import Icon from '../../components/feedback/Icon';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import useAsync from '../../hooks/useAsync';
import { listAllOrders, getTotalRevenue } from '../../services/orderService';
import { listPendingVendors, countActiveVendors } from '../../services/vendorService';
import { currencyCompact, currency, number, initials } from '../../utils/format';
import { timeAgo } from '../../utils/dates';
import { ORDER_STATUS } from '../../constants/orders';

/**
 * Platform overview — the same four live figures the Flutter overview screen
 * reads: GET /total-revenue, /all-orders, /active-vendors and /pending-vendor.
 * Revenue is REALISED revenue, i.e. delivered orders only.
 */
export default function AdminDashboard() {
  const orders = useAsync(listAllOrders, []);
  const revenue = useAsync(getTotalRevenue, []);
  const pending = useAsync(listPendingVendors, []);
  const active = useAsync(countActiveVendors, []);

  const stats = useMemo(() => {
    const list = orders.data || [];
    const delivered = list.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED).length;
    const openPipeline = list.filter((o) =>
      [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY]
        .includes(o.orderStatus)).length;
    return {
      total: list.length,
      delivered,
      openPipeline,
      deliveredRate: list.length ? Math.round((delivered / list.length) * 100) : 0,
      recent: list.slice(0, 7),
    };
  }, [orders.data]);

  const loading = orders.loading || revenue.loading;

  return (
    <>
      <PageHeader
        title="Platform overview"
        sub="Every order, vendor and rupee moving through VS Arogya."
        actions={(
          <>
            <Button icon="refresh" onClick={() => { orders.reload(); revenue.reload(); pending.reload(); active.reload(); }}>
              Refresh
            </Button>
            <Button variant="primary" icon="chart" to="/admin/analytics">Open analytics</Button>
          </>
        )}
      />

      <section className="hero section">
        <div className="hero__inner">
          <div>
            <p className="hero__eyebrow">Realised revenue · delivered orders</p>
            <p className="hero__value">{revenue.loading ? '—' : currencyCompact(revenue.data || 0)}</p>
            <p className="hero__note">
              Recognised only once an order reaches Delivered — pending and in-flight orders are excluded.
            </p>
          </div>
          <div className="hero__facts">
            <div>
              <p className="hero__fact-value">{number(stats.total)}</p>
              <p className="hero__fact-label">Total orders</p>
            </div>
            <div>
              <p className="hero__fact-value">{stats.deliveredRate}%</p>
              <p className="hero__fact-label">Delivered rate</p>
            </div>
            <div>
              <p className="hero__fact-value">{number(active.data ?? 0)}</p>
              <p className="hero__fact-label">Active vendors</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid--kpi section">
        {loading ? <CardSkeleton count={4} /> : (
          <>
            <StatTile label="Orders in pipeline" value={number(stats.openPipeline)} icon="receipt" tone="info"
              foot="Pending through Out for Delivery" to="/admin/orders" />
            <StatTile label="Delivered orders" value={number(stats.delivered)} icon="check"
              foot="Lifetime completed" to="/admin/orders" />
            <StatTile label="Pending approvals" value={number(pending.data?.length ?? 0)} icon="shield"
              tone={pending.data?.length ? 'warning' : undefined}
              foot="Vendors waiting on KYC review" to="/admin/vendors" />
            <StatTile label="Active vendors" value={number(active.data ?? 0)} icon="store"
              foot="Approved and able to order" to="/admin/vendors" />
          </>
        )}
      </div>

      <div className="split">
        <Card>
          <CardHead
            title="Recent orders"
            sub="Newest first, across every vendor"
            actions={<Button size="sm" variant="ghost" iconRight="arrowRight" to="/admin/orders">View all</Button>}
          />
          {orders.loading ? (
            <CardBody><div className="stack gap-3"><CardSkeleton count={3} /></div></CardBody>
          ) : stats.recent.length === 0 ? (
            <EmptyState icon="receipt" title="No orders yet" text="Orders placed by vendors, marketing or outlets appear here." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th><th>Buyer</th><th>Status</th>
                    <th className="cell-num">Amount</th><th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((o) => (
                    <tr key={o._id}>
                      <td>
                        <Link to={`/admin/orders/${o._id}`} className="mono" style={{ fontWeight: 700, color: 'var(--brand-700)' }}>
                          {o.orderNo}
                        </Link>
                      </td>
                      <td>
                        <span className="row gap-2">
                          <span className="avatar avatar--sm">{initials(o.user.store_name)}</span>
                          <span className="truncate">{o.user.store_name}</span>
                        </span>
                      </td>
                      <td><OrderStatusBadge status={o.orderStatus} /></td>
                      <td className="cell-num">{currency(o.totalAmount)}</td>
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
            <CardHead title="Awaiting approval" sub="Vendors blocked from signing in until reviewed" />
            <CardBody className="stack gap-3">
              {pending.loading && <CardSkeleton count={2} />}
              {!pending.loading && !pending.data?.length && (
                <p className="subtle">Nothing waiting — every registration has been reviewed.</p>
              )}
              {pending.data?.slice(0, 5).map((v) => (
                <Link to={`/admin/vendors/${v._id}`} key={v._id} className="row gap-3">
                  <span className="avatar avatar--sm">{initials(v.store_name)}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{v.store_name}</span>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                      {v.city} · applied {timeAgo(v.createdAt)}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={14} />
                </Link>
              ))}
              {pending.data?.length > 5 && (
                <Button size="sm" variant="soft" block to="/admin/vendors">
                  Review all {pending.data.length}
                </Button>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Quick actions" />
            <CardBody className="stack gap-2">
              <Button variant="secondary" icon="truck" block to="/admin/delivery">Create a delivery agent</Button>
              <Button variant="secondary" icon="pill" block to="/admin/products">Browse the catalogue</Button>
              <Button variant="secondary" icon="users" block to="/admin/users">User management</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
