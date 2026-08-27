import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useToast } from '../../context/ToastContext';
import { listAllOrders, advanceOrder } from '../../services/orderService';
import { ORDER_STATUS, NEXT_ACTION } from '../../constants/orders';
import { currency, number, initials } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';

/**
 * Marketplace-wide order monitor. The contextual "advance status" action maps
 * one-to-one onto the four PUT endpoints; accepting an order is what generates
 * its invoice and deducts stock server-side.
 */
export default function AdminOrders() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const vendorFilter = params.get('vendor');
  const { data, loading, error, reload, setData } = useAsync(listAllOrders, []);
  const [status, setStatus] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const scoped = useMemo(() => {
    let rows = data || [];
    if (vendorFilter) rows = rows.filter((o) => o.user._id === vendorFilter);
    if (status) rows = rows.filter((o) => o.orderStatus === status);
    return rows;
  }, [data, status, vendorFilter]);

  const table = useTableControls(scoped, {
    searchKeys: ['orderNo', (o) => o.user.store_name, (o) => o.user.mobile_no],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    const by = (s) => rows.filter((o) => o.orderStatus === s).length;
    return {
      all: rows.length,
      [ORDER_STATUS.PENDING]: by(ORDER_STATUS.PENDING),
      [ORDER_STATUS.CONFIRMED]: by(ORDER_STATUS.CONFIRMED),
      [ORDER_STATUS.SHIPPED]: by(ORDER_STATUS.SHIPPED),
      [ORDER_STATUS.OUT_FOR_DELIVERY]: by(ORDER_STATUS.OUT_FOR_DELIVERY),
      [ORDER_STATUS.DELIVERED]: by(ORDER_STATUS.DELIVERED),
      [ORDER_STATUS.CANCELLED]: by(ORDER_STATUS.CANCELLED),
    };
  }, [data]);

  const advance = async (order) => {
    const action = NEXT_ACTION[order.orderStatus];
    if (!action) return;
    setBusyId(order._id);
    try {
      const updated = await advanceOrder(order._id, action.transition);
      setData((rows) => rows.map((o) => (o._id === updated._id ? updated : o)));
      toast.success(`${order.orderNo} → ${updated.orderStatus}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: 'orderNo',
      header: 'Order',
      sortable: true,
      render: (o) => (
        <span>
          <span className="mono" style={{ display: 'block', fontWeight: 700 }}>{o.orderNo}</span>
          <span className="row gap-1" style={{ marginTop: 2 }}>
            {o.source === 'MANUAL_BY_MARKETING' && <Badge tone="accent">Manual</Badge>}
            {o.outlet && <Badge tone="info">Outlet</Badge>}
          </span>
        </span>
      ),
    },
    {
      key: (o) => o.user.store_name,
      header: 'Buyer',
      sortable: true,
      render: (o) => (
        <span className="row gap-3">
          <span className="avatar avatar--sm">{initials(o.user.store_name)}</span>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{o.user.store_name}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
              {o.shippingAddress.city} · {o.shippingAddress.pincode}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: (o) => o.orderItems.length,
      header: 'Items',
      align: 'right',
      sortable: true,
      render: (o) => number(o.orderItems.reduce((s, it) => s + it.quantity, 0)),
    },
    { key: 'totalAmount', header: 'Amount', align: 'right', sortable: true, render: (o) => currency(o.totalAmount) },
    {
      key: (o) => o.paymentInfo?.status,
      header: 'Payment',
      render: (o) => (
        <span className="stack gap-1">
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{o.paymentMethod}</span>
          <Badge tone={o.paymentInfo?.status === 'Completed' ? 'success' : 'muted'}>
            {o.paymentInfo?.status || 'Pending'}
          </Badge>
        </span>
      ),
    },
    { key: 'orderStatus', header: 'Status', sortable: true, render: (o) => <OrderStatusBadge status={o.orderStatus} /> },
    { key: 'createdAt', header: 'Placed', sortable: true, render: (o) => <span className="subtle nowrap">{formatDateTime(o.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (o) => {
        const action = NEXT_ACTION[o.orderStatus];
        return (
          <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
            {action && (
              <Button size="sm" variant="primary" loading={busyId === o._id} onClick={() => advance(o)}>
                {action.label}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/orders/${o._id}`)}>Open</Button>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Every order on the platform — vendor-placed, marketing-placed and outlet-placed."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="section">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { key: null, label: 'All', count: counts.all },
            { key: ORDER_STATUS.PENDING, label: 'Pending', count: counts[ORDER_STATUS.PENDING] },
            { key: ORDER_STATUS.CONFIRMED, label: 'Confirmed', count: counts[ORDER_STATUS.CONFIRMED] },
            { key: ORDER_STATUS.SHIPPED, label: 'Shipped', count: counts[ORDER_STATUS.SHIPPED] },
            { key: ORDER_STATUS.OUT_FOR_DELIVERY, label: 'Out for delivery', count: counts[ORDER_STATUS.OUT_FOR_DELIVERY] },
            { key: ORDER_STATUS.DELIVERED, label: 'Delivered', count: counts[ORDER_STATUS.DELIVERED] },
            { key: ORDER_STATUS.CANCELLED, label: 'Cancelled', count: counts[ORDER_STATUS.CANCELLED] },
          ]}
        />
      </div>

      <Card>
        <TableToolbar
          query={table.query}
          onQuery={table.setQuery}
          placeholder="Search by order number, buyer or mobile…"
          right={vendorFilter && <Button size="sm" variant="ghost" icon="x" to="/admin/orders">Clear vendor filter</Button>}
        />
        <DataTable
          columns={columns}
          rows={table.rows}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={table.sort}
          onSort={table.toggleSort}
          onRowClick={(o) => navigate(`/admin/orders/${o._id}`)}
          empty={{ icon: 'receipt', title: 'No orders here', text: 'Try a different status filter or clear the search.' }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="orders"
        />
      </Card>
    </>
  );
}
