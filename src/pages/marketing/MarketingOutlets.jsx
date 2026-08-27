import { useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listOutlets } from '../../services/outletService';
import { formatDate } from '../../utils/dates';
import { number, initials } from '../../utils/format';

/**
 * The outlet network. Outlets live in their OWN collection with their own login
 * (POST /outlet-login) — they are not Vendor accounts, which is why they never
 * appear in the vendor directory.
 */
export default function MarketingOutlets() {
  const { data, loading, error, reload } = useAsync(listOutlets, []);
  const table = useTableControls(data, {
    searchKeys: ['outletName', 'ownerName', 'mobileNo', 'city', 'pincode'],
    initialSort: { key: 'outletName', dir: 'asc' },
  });

  const stats = useMemo(() => {
    const rows = data || [];
    return {
      total: rows.length,
      active: rows.filter((o) => o.status === 'Active').length,
      pincodes: new Set(rows.map((o) => o.pincode)).size,
    };
  }, [data]);

  const columns = [
    {
      key: 'outletName',
      header: 'Outlet',
      sortable: true,
      render: (o) => (
        <span className="row gap-3">
          <span className="avatar avatar--sm">{initials(o.outletName)}</span>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{o.outletName}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{o.ownerName}</span>
          </span>
        </span>
      ),
    },
    { key: 'mobileNo', header: 'Login id (mobile)', render: (o) => <span className="mono">{o.mobileNo}</span> },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      render: (o) => (
        <span>
          <span style={{ display: 'block' }}>{o.address}</span>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{o.city} · {o.pincode}</span>
        </span>
      ),
    },
    { key: 'gstNumber', header: 'GSTIN', render: (o) => <span className="mono">{o.gstNumber || '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (o) => <Badge tone={o.status === 'Active' ? 'success' : 'muted'} dot>{o.status}</Badge>,
    },
    { key: 'createdAt', header: 'Registered', sortable: true, render: (o) => <span className="subtle nowrap">{formatDate(o.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (o) => (
        <Button size="sm" variant="secondary" icon="send" to={`/marketing/outlets/assign-stock?outlet=${o._id}`}>
          Assign stock
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Outlets"
        sub="Physical VS Arogya counters. Each has its own login and holds its own batch-tracked stock."
        actions={(
          <>
            <Button icon="send" to="/marketing/outlets/assign-stock">Assign stock</Button>
            <Button variant="primary" icon="plus" to="/marketing/outlets/new">Register outlet</Button>
          </>
        )}
      />

      <div className="grid grid--kpi section">
        <StatTile label="Outlets" value={number(stats.total)} icon="store" />
        <StatTile label="Active" value={number(stats.active)} icon="check" foot={`${stats.total - stats.active} inactive`} />
        <StatTile label="Pincodes covered" value={number(stats.pincodes)} icon="pin" tone="info" />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by outlet, owner, mobile or pincode…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          empty={{
            icon: 'store',
            title: 'No outlets yet',
            text: 'Register the first physical outlet to start assigning it stock.',
            action: <Button variant="primary" icon="plus" to="/marketing/outlets/new">Register outlet</Button>,
          }}
        />
      </Card>
    </>
  );
}
