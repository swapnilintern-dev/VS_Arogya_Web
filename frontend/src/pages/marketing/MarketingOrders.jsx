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
import { useToast } from '../../context/ToastContext';
import { listAllOrders, advanceOrder } from '../../services/orderService';
import { MARKETING_PIPELINE, NEXT_ACTION, ORDER_STATUS } from '../../constants/orders';
import { currency, number, initials } from '../../utils/format';
import { timeAgo } from '../../utils/dates';

/**
 * The fulfilment pipeline. The app's tab labels are kept — New / Packing /
 * Ready / Shipped / Done — because that is the vocabulary the marketing team
 * actually uses, even though the underlying statuses are the backend's.
 */
export default function MarketingOrders() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(listAllOrders, []);
  const [status, setStatus] = useState(ORDER_STATUS.PENDING);
  const [busyId, setBusyId] = useState(null);

  const scoped = useMemo(
    () => (status ? (data || []).filter((o) => o.orderStatus === status) : data || []),
    [data, status],
  );

  const table = useTableControls(scoped, {
    searchKeys: ['orderNo', (o) => o.user.store_name, (o) => o.user.mobile_no],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    return rows.reduce((acc, o) => ({ ...acc, [o.orderStatus]: (acc[o.orderStatus] || 0) + 1 }), { all: rows.length });
  }, [data]);

  const advance = async (order) => {
    const action = NEXT_ACTION[order.orderStatus];
    if (!action) return;
    setBusyId(order._id);
    try {
      const updated = await advanceOrder(order._id, action.transition);
      setData((rows) => rows.map((o) => (o._id === updated._id ? updated : o)));
      toast.success(
        action.transition === 'confirm'
          ? `${order.orderNo} accepted — invoice generated and stock deducted.`
          : `${order.orderNo} → ${updated.orderStatus}`,
      );
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
            <span className="subtle mono" style={{ fontSize: 'var(--fs-xs)' }}>{o.user.mobile_no}</span>
          </span>
        </span>
      ),
    },
    {
      key: (o) => o.orderItems.length,
      header: 'Lines',
      align: 'right',
      sortable: true,
      render: (o) => (
        <span>
          <strong style={{ display: 'block' }}>{o.orderItems.length}</strong>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            {number(o.orderItems.reduce((s, it) => s + it.quantity, 0))} units
          </span>
        </span>
      ),
    },
    { key: 'totalAmount', header: 'Amount', align: 'right', sortable: true, render: (o) => <strong>{currency(o.totalAmount)}</strong> },
    {
      key: (o) => o.shippingAddress.city,
      header: 'Ship to',
      sortable: true,
      render: (o) => (
        <span>
          <span style={{ display: 'block' }}>{o.shippingAddress.city}</span>
          <span className="subtle mono" style={{ fontSize: 'var(--fs-xs)' }}>{o.shippingAddress.pincode}</span>
        </span>
      ),
    },
    { key: 'orderStatus', header: 'Status', sortable: true, render: (o) => <OrderStatusBadge status={o.orderStatus} /> },
    { key: 'createdAt', header: 'Placed', sortable: true, render: (o) => <span className="subtle nowrap">{timeAgo(o.createdAt)}</span> },
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
            <Button size="sm" variant="secondary" onClick={() => navigate(`/marketing/orders/${o._id}`)}>Details</Button>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Accepting an order generates its tax invoice and deducts stock from the FEFO front lots."
        actions={(
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            <Button variant="primary" icon="plus" to="/marketing/orders/manual">Create manual order</Button>
          </>
        )}
      />

      <div className="section">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { key: null, label: 'All', count: counts.all },
            ...MARKETING_PIPELINE.map((p) => ({ key: p.key, label: p.label, count: counts[p.key] || 0 })),
            { key: ORDER_STATUS.CANCELLED, label: 'Cancelled', count: counts[ORDER_STATUS.CANCELLED] || 0 },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by order number, buyer or mobile…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(o) => navigate(`/marketing/orders/${o._id}`)}
          empty={{
            icon: 'check',
            title: 'Nothing in this stage',
            text: 'Orders move through New → Packing → Ready → Shipped → Done as you advance them.',
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
