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
import { listAllOrders } from '../../services/orderService';
import { listProducts, listAllBatches } from '../../services/productService';
import { listCoupons } from '../../services/couponService';
import { ORDER_STATUS } from '../../constants/orders';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';
import { expiryTierOf, EXPIRY_TIER } from '../../utils/expiry';
import { currency, number, initials } from '../../utils/format';
import { timeAgo } from '../../utils/dates';

const QUICK_ACTIONS = [
  ['plus', 'Create manual order', 'Place a phone order on a vendor’s behalf', '/marketing/orders/manual'],
  ['send', 'Assign stock to an outlet', 'Push catalogue stock into a physical outlet', '/marketing/outlets/assign-stock'],
  ['store', 'Register an outlet', 'Add an outlet and set its login', '/marketing/outlets/new'],
  ['pin', 'Register an area agent', 'Assign a pincode monitor', '/marketing/agents/new'],
  ['bell', 'Send a notification', 'Broadcast to every vendor', '/marketing/notifications/new'],
  ['download', 'Generate a report', 'Order and vendor exports (.xlsx)', '/marketing/reports'],
];

/**
 * The marketing head's landing page. The four headline figures are the same
 * ones the app's dashboard grid shows (pending orders, ready to ship, low/out
 * stock, active coupons), plus the expiry watchlist the batch system makes
 * possible — which is the single most operationally useful thing this role has.
 */
export default function MarketingDashboard() {
  const orders = useAsync(listAllOrders, []);
  const products = useAsync(listProducts, []);
  const batches = useAsync(listAllBatches, []);
  const coupons = useAsync(listCoupons, []);

  const stats = useMemo(() => {
    const list = orders.data || [];
    const cat = products.data || [];
    return {
      pending: list.filter((o) => o.orderStatus === ORDER_STATUS.PENDING).length,
      readyToShip: list.filter((o) => o.orderStatus === ORDER_STATUS.CONFIRMED).length,
      lowOrOut: cat.filter((p) => stockStatusOf(p.stock, p.lowThreshold) !== STOCK_STATUS.IN).length,
      activeCoupons: (coupons.data || []).filter((c) => c.active && !c.expired).length,
      newOrders: list.filter((o) => o.orderStatus === ORDER_STATUS.PENDING).slice(0, 6),
    };
  }, [orders.data, products.data, coupons.data]);

  /** Lots at or past 90 days — the backend's own isExpiringSoon window. */
  const expiring = useMemo(() => (batches.data || [])
    .filter((b) => b.available_quantity > 0)
    .map((b) => ({ ...b, tier: expiryTierOf(b.expiry_date) }))
    .filter((b) => [EXPIRY_TIER.EXPIRED, EXPIRY_TIER.CRITICAL, EXPIRY_TIER.WARNING].includes(b.tier))
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .slice(0, 8), [batches.data]);

  const lowStock = useMemo(() => (products.data || [])
    .filter((p) => stockStatusOf(p.stock, p.lowThreshold) !== STOCK_STATUS.IN)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6), [products.data]);

  const loading = orders.loading || products.loading;

  return (
    <>
      <PageHeader
        title="Marketing dashboard"
        sub="Inventory, fulfilment and the outlet network in one place."
        actions={(
          <>
            <Button icon="refresh" onClick={() => { orders.reload(); products.reload(); batches.reload(); coupons.reload(); }}>
              Refresh
            </Button>
            <Button variant="primary" icon="plus" to="/marketing/products/new">Add medicine</Button>
          </>
        )}
      />

      <div className="grid grid--kpi section stagger">
        {loading ? <CardSkeleton count={4} /> : (
          <>
            <StatTile label="New orders" value={number(stats.pending)} icon="receipt"
              tone={stats.pending ? 'warning' : undefined}
              foot="Waiting to be accepted" to="/marketing/orders" />
            <StatTile label="Ready to ship" value={number(stats.readyToShip)} icon="box" tone="info"
              foot="Accepted and being packed" to="/marketing/orders" />
            <StatTile label="Low / out of stock" value={number(stats.lowOrOut)} icon="alert"
              tone={stats.lowOrOut ? 'danger' : undefined}
              foot="SKUs needing a restock" to="/marketing/products" />
            <StatTile label="Active coupons" value={number(stats.activeCoupons)} icon="tag" tone="accent"
              foot="Live for vendors right now" to="/marketing/coupons" />
          </>
        )}
      </div>

      <section className="section">
        <div className="section__head"><h2 className="section__title">Quick actions</h2></div>
        <div className="grid grid--cards">
          {QUICK_ACTIONS.map(([icon, title, text, to]) => (
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
            title="New orders"
            sub="Accepting an order generates its invoice and deducts stock"
            actions={<Button size="sm" variant="ghost" iconRight="arrowRight" to="/marketing/orders">Open pipeline</Button>}
          />
          {orders.loading ? <CardBody><CardSkeleton count={3} /></CardBody>
            : stats.newOrders.length === 0 ? (
              <EmptyState icon="check" title="Nothing waiting" text="Every incoming order has been accepted." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Order</th><th>Buyer</th><th className="cell-num">Amount</th><th>Status</th><th>Placed</th></tr>
                  </thead>
                  <tbody>
                    {stats.newOrders.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <Link to={`/marketing/orders/${o._id}`} className="mono" style={{ fontWeight: 700, color: 'var(--brand-700)' }}>
                            {o.orderNo}
                          </Link>
                          {o.source === 'MANUAL_BY_MARKETING' && <Badge tone="accent" className="nowrap">Manual</Badge>}
                        </td>
                        <td>
                          <span className="row gap-2">
                            <span className="avatar avatar--sm">{initials(o.user.store_name)}</span>
                            <span className="truncate">{o.user.store_name}</span>
                          </span>
                        </td>
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
            <CardHead
              title="Expiry watchlist"
              sub="Lots within 90 days, nearest first"
              actions={<Button size="sm" variant="ghost" iconRight="arrowRight" to="/marketing/batches">All lots</Button>}
            />
            <CardBody className="stack gap-3">
              {batches.loading && <CardSkeleton count={2} />}
              {!batches.loading && expiring.length === 0 && (
                <p className="subtle">No lot expires within 90 days. Nothing needs pulling.</p>
              )}
              {expiring.map((b) => (
                <Link to={`/marketing/products/${b.product_id}`} key={b._id} className="row gap-3">
                  <ProductThumb product={b.product} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>
                      {b.product?.title || 'Medicine'}
                    </span>
                    <span className="row gap-2" style={{ marginTop: 2 }}>
                      <span className="mono subtle" style={{ fontSize: 'var(--fs-xs)' }}>{b.batch_number}</span>
                      <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                        {number(b.available_quantity)} units
                      </span>
                    </span>
                  </span>
                  <ExpiryBadge date={b.expiry_date} dense />
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Needs restocking"
              actions={<Button size="sm" variant="ghost" iconRight="arrowRight" to="/marketing/products">Inventory</Button>}
            />
            <CardBody className="stack gap-3">
              {products.loading && <CardSkeleton count={2} />}
              {!products.loading && lowStock.length === 0 && <p className="subtle">Every SKU is above its reorder threshold.</p>}
              {lowStock.map((p) => (
                <Link to={`/marketing/products/${p._id}`} key={p._id} className="row gap-3">
                  <ProductThumb product={p} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{p.title}</span>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{p.brand}</span>
                  </span>
                  <Badge tone={p.stock === 0 ? 'danger' : 'warning'} dot>
                    {p.stock === 0 ? 'Out' : `${p.stock} left`}
                  </Badge>
                </Link>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
