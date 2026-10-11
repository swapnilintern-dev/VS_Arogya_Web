import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Segmented from '../../components/common/Segmented';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listDelivered } from '../../services/deliveryService';
import { currency, number, initials } from '../../utils/format';
import { formatDateTime, daysUntil } from '../../utils/dates';

const RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: 'This week', days: 7 },
  { key: 'month', label: 'This month', days: 30 },
  { key: 'all', label: 'All time', days: null },
];

/** Completed deliveries, filterable by date range. */
export default function DeliveryHistory() {
  const { data, loading, error, reload } = useAsync(listDelivered, []);
  const [range, setRange] = useState('week');

  const scoped = useMemo(() => {
    const rows = data || [];
    const spec = RANGES.find((r) => r.key === range);
    if (!spec?.days) return rows;
    return rows.filter((o) => {
      const days = -daysUntil(o.deliveredAt || o.updatedAt || o.createdAt);
      return days !== null && days <= spec.days;
    });
  }, [data, range]);

  const table = useTableControls(scoped, {
    searchKeys: ['orderNo', (o) => o.user.store_name],
    initialSort: { key: 'deliveredAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    const inRange = (days) => (days === null
      ? rows
      : rows.filter((o) => {
        const d = -daysUntil(o.deliveredAt || o.createdAt);
        return d !== null && d <= days;
      }));
    return RANGES.reduce((acc, r) => ({ ...acc, [r.key]: inRange(r.days).length }), {});
  }, [data]);

  const value = scoped.reduce((s, o) => s + o.totalAmount, 0);

  const columns = [
    { key: 'orderNo', header: 'Order', sortable: true, render: (o) => <span className="mono" style={{ fontWeight: 700 }}>{o.orderNo}</span> },
    {
      key: (o) => o.user.store_name,
      header: 'Delivered to',
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
    { key: 'totalAmount', header: 'Order value', align: 'right', sortable: true, render: (o) => currency(o.totalAmount) },
    { key: 'paymentMethod', header: 'Payment', render: (o) => o.paymentMethod },
    { key: 'deliveredAt', header: 'Delivered', sortable: true, render: (o) => <span className="subtle nowrap">{formatDateTime(o.deliveredAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="My deliveries"
        sub="Everything you've completed."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="Deliveries in range" value={number(scoped.length)} icon="check" />
        <StatTile label="Order value delivered" value={currency(value)} icon="rupee" />
        <StatTile label="All time" value={number(data?.length ?? 0)} icon="truck" foot="Total completed" />
      </div>

      <Note tone="info" className="section">
        The order record has no per-agent field, so this shows every delivered order platform-wide rather
        than only yours. Per-rider history needs a backend change.
      </Note>

      <div className="section">
        <Segmented
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ key: r.key, label: r.label, count: counts[r.key] }))}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by order number or store…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          empty={{ icon: 'truck', title: 'Nothing in this range', text: 'Pick a wider date range to see more.' }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="deliveries"
        />
      </Card>
    </>
  );
}
