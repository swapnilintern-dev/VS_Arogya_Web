import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Segmented from '../../components/common/Segmented';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { useAuth } from '../../context/AuthContext';
import { listMyOrders } from '../../services/orderService';
import { ORDER_STATUS } from '../../constants/orders';
import { currency, number } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';

const ACTIVE = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY];

/** The vendor's own order history — All / Active / Delivered / Cancelled. */
export default function VendorOrders() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => listMyOrders(session.id), [session.id]);
  const [filter, setFilter] = useState('all');

  const scoped = useMemo(() => {
    const rows = data || [];
    if (filter === 'active') return rows.filter((o) => ACTIVE.includes(o.orderStatus));
    if (filter === 'delivered') return rows.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED);
    if (filter === 'cancelled') return rows.filter((o) => o.orderStatus === ORDER_STATUS.CANCELLED);
    return rows;
  }, [data, filter]);

  const table = useTableControls(scoped, {
    searchKeys: ['orderNo', (o) => o.orderItems.map((i) => i.product?.title).join(' ')],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    return {
      all: rows.length,
      active: rows.filter((o) => ACTIVE.includes(o.orderStatus)).length,
      delivered: rows.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED).length,
      cancelled: rows.filter((o) => o.orderStatus === ORDER_STATUS.CANCELLED).length,
    };
  }, [data]);

  const columns = [
    { key: 'orderNo', header: 'Order', sortable: true, render: (o) => <span className="mono" style={{ fontWeight: 700 }}>{o.orderNo}</span> },
    {
      key: (o) => o.orderItems.length,
      header: 'Items',
      render: (o) => (
        <span style={{ minWidth: 0 }}>
          <span className="truncate" style={{ display: 'block' }}>
            {o.orderItems.map((i) => i.product?.title).filter(Boolean).slice(0, 2).join(', ')}
            {o.orderItems.length > 2 ? ` +${o.orderItems.length - 2} more` : ''}
          </span>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            {number(o.orderItems.reduce((s, it) => s + it.quantity, 0))} units
          </span>
        </span>
      ),
    },
    { key: 'totalAmount', header: 'Total', align: 'right', sortable: true, render: (o) => <strong>{currency(o.totalAmount)}</strong> },
    {
      key: (o) => o.paymentInfo?.status,
      header: 'Payment',
      render: (o) => (
        <Badge tone={o.paymentInfo?.status === 'Completed' ? 'success' : 'muted'} dot>
          {o.paymentMethod} · {o.paymentInfo?.status || 'Pending'}
        </Badge>
      ),
    },
    { key: 'orderStatus', header: 'Status', sortable: true, render: (o) => <OrderStatusBadge status={o.orderStatus} /> },
    { key: 'createdAt', header: 'Placed', sortable: true, render: (o) => <span className="subtle nowrap">{formatDateTime(o.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (o) => <Button size="sm" variant="secondary" onClick={() => navigate(`/shop/orders/${o._id}`)}>Track</Button>,
    },
  ];

  return (
    <>
      <PageHeader
        title="My orders"
        sub="Track what you've ordered and download the tax invoices."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="section">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'delivered', label: 'Delivered', count: counts.delivered },
            { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by order number or medicine…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(o) => navigate(`/shop/orders/${o._id}`)}
          empty={{
            icon: 'receipt',
            title: 'No orders here',
            text: 'Once you place an order it appears here with live tracking.',
            action: <Button variant="primary" to="/shop/products">Browse the catalogue</Button>,
          }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="orders"
        />
      </Card>
    </>
  );
}
