import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Segmented from '../../components/common/Segmented';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { useAuth } from '../../context/AuthContext';
import { listPincodeOrders } from '../../services/vendorService';
import { ORDER_STATUS } from '../../constants/orders';
import { currency, number, initials } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';

const IN_FLIGHT = [
  ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY,
];

/**
 * The area agent's monitor.
 *
 * Their whole job is read-only: see every order whose DELIVERY ADDRESS falls in
 * their assigned pincode. There are no actions on an order anywhere in this
 * role — not on this page and not on the detail page.
 */
export default function AgentDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('inflight');

  const { data, loading, error, reload } = useAsync(
    () => listPincodeOrders(session.id),
    [session.id],
  );

  const scoped = useMemo(() => {
    const rows = data || [];
    if (filter === 'inflight') return rows.filter((o) => IN_FLIGHT.includes(o.orderStatus));
    return rows;
  }, [data, filter]);

  const table = useTableControls(scoped, {
    searchKeys: ['orderNo', (o) => o.user.store_name],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    return {
      all: rows.length,
      inflight: rows.filter((o) => IN_FLIGHT.includes(o.orderStatus)).length,
      value: rows.reduce((s, o) => s + o.totalAmount, 0),
      buyers: new Set(rows.map((o) => o.user._id)).size,
    };
  }, [data]);

  const columns = [
    { key: 'orderNo', header: 'Order', sortable: true, render: (o) => <span className="mono" style={{ fontWeight: 700 }}>{o.orderNo}</span> },
    {
      key: (o) => o.user.store_name,
      header: 'Buyer',
      sortable: true,
      render: (o) => (
        <span className="row gap-3">
          <span className="avatar avatar--sm">{initials(o.user.store_name)}</span>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{o.user.store_name}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{o.shippingAddress.address}</span>
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
    { key: 'totalAmount', header: 'Value', align: 'right', sortable: true, render: (o) => currency(o.totalAmount) },
    { key: 'orderStatus', header: 'Status', sortable: true, render: (o) => <OrderStatusBadge status={o.orderStatus} /> },
    { key: 'createdAt', header: 'Placed', sortable: true, render: (o) => <span className="subtle nowrap">{formatDateTime(o.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (o) => <Button size="sm" variant="secondary" onClick={() => navigate(`/agent/orders/${o._id}`)}>View</Button>,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Pincode ${session?.pincode || '—'}`}
        sub="Every order being delivered into your area."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="In flight" value={number(counts.inflight)} icon="truck" tone="info"
          foot="Placed through Out for Delivery" />
        <StatTile label="Buyers served" value={number(counts.buyers)} icon="store" />
        <StatTile label="Order value" value={currency(counts.value)} icon="rupee" foot="Live orders in your pincode" />
      </div>

      <Note tone="info" className="section">
        This is a read-only monitor. You can see status and line items for every order delivering into
        pincode {session?.pincode}, but accepting, shipping and cancelling stay with the marketing team.
      </Note>

      <div className="section">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'inflight', label: 'In flight', count: counts.inflight },
            { key: 'all', label: 'All', count: counts.all },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by order number or buyer…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(o) => navigate(`/agent/orders/${o._id}`)}
          empty={{
            icon: 'pin',
            title: 'No orders in your pincode',
            text: `Nothing is currently being delivered into ${session?.pincode}.`,
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
