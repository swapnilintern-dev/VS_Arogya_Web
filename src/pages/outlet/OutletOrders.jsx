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
import { listOutletOrders } from '../../services/outletService';
import { ORDER_STATUS } from '../../constants/orders';
import { currency, number } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';

const AWAITING = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED];

/** Every order placed from this counter, newest first. */
export default function OutletOrders() {
  const navigate = useNavigate();
  const { outletId } = useAuth();
  const { data, loading, error, reload } = useAsync(() => listOutletOrders(outletId), [outletId]);
  const [filter, setFilter] = useState('all');

  const scoped = useMemo(() => {
    const rows = data || [];
    if (filter === 'unpaid') return rows.filter((o) => o.paymentInfo?.status !== 'Completed');
    if (filter === 'open') return rows.filter((o) => AWAITING.includes(o.orderStatus));
    if (filter === 'done') return rows.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED);
    return rows;
  }, [data, filter]);

  const table = useTableControls(scoped, {
    searchKeys: ['orderNo', (o) => o.user.store_name, (o) => o.user.mobile_no],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    return {
      all: rows.length,
      unpaid: rows.filter((o) => o.paymentInfo?.status !== 'Completed').length,
      open: rows.filter((o) => AWAITING.includes(o.orderStatus)).length,
      done: rows.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED).length,
    };
  }, [data]);

  const columns = [
    { key: 'orderNo', header: 'Order', sortable: true, render: (o) => <span className="mono" style={{ fontWeight: 700 }}>{o.orderNo}</span> },
    {
      key: (o) => o.user.store_name,
      header: 'Customer',
      sortable: true,
      render: (o) => (
        <span style={{ minWidth: 0 }}>
          <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{o.user.store_name}</span>
          <span className="subtle mono" style={{ fontSize: 'var(--fs-xs)' }}>{o.user.mobile_no}</span>
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
    { key: 'totalAmount', header: 'Amount', align: 'right', sortable: true, render: (o) => <strong>{currency(o.totalAmount)}</strong> },
    {
      key: (o) => o.paymentInfo?.status,
      header: 'Payment',
      sortable: true,
      render: (o) => (
        <Badge tone={o.paymentInfo?.status === 'Completed' ? 'success' : 'warning'} dot>
          {o.paymentInfo?.status === 'Completed' ? 'Paid' : 'Awaiting payment'}
        </Badge>
      ),
    },
    { key: 'orderStatus', header: 'Status', sortable: true, render: (o) => <OrderStatusBadge status={o.orderStatus} /> },
    { key: 'createdAt', header: 'Placed', sortable: true, render: (o) => <span className="subtle nowrap">{formatDateTime(o.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (o) => <Button size="sm" variant="secondary" onClick={() => navigate(`/outlet/orders/${o._id}`)}>Open</Button>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Bills and manual orders placed from this counter."
        actions={(
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            <Button variant="primary" icon="receipt" to="/outlet/billing">Start a bill</Button>
          </>
        )}
      />

      <div className="section">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'unpaid', label: 'Awaiting payment', count: counts.unpaid },
            { key: 'open', label: 'In progress', count: counts.open },
            { key: 'done', label: 'Completed', count: counts.done },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by order number, customer or mobile…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(o) => navigate(`/outlet/orders/${o._id}`)}
          empty={{
            icon: 'receipt',
            title: 'No orders yet',
            text: 'Bills you place at the counter appear here.',
            action: <Button variant="primary" to="/outlet/billing">Start a bill</Button>,
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
