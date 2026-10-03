import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import StockBadge from '../../features/StockBadge';
import ExpiryBadge from '../../features/ExpiryBadge';
import ProductThumb from '../../features/ProductThumb';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { useAuth } from '../../context/AuthContext';
import { listOutletStock } from '../../services/outletService';
import { currency, number } from '../../utils/format';

/**
 * This outlet's own stock.
 *
 * There is no district view — an outlet sells only from what it holds. The
 * quantity shown is the server's mirror of the SUM over this outlet's lots for
 * that product, and the front lot is the one FEFO will consume first.
 */
export default function OutletStock() {
  const navigate = useNavigate();
  const { outletId } = useAuth();
  const { data, loading, error, reload } = useAsync(() => listOutletStock(outletId), [outletId]);

  const rows = data || [];

  const table = useTableControls(rows, {
    searchKeys: [(r) => r.product.title, (r) => r.product.brand, (r) => r.product.code],
    initialSort: { key: (r) => r.product.title, dir: 'asc' },
    pageSize: 15,
  });

  const stats = useMemo(() => ({
    skus: rows.length,
    units: rows.reduce((s, r) => s + r.quantity, 0),
    value: rows.reduce((s, r) => s + r.quantity * r.product.price, 0),
    empty: rows.filter((r) => r.quantity === 0).length,
  }), [rows]);

  const columns = [
    {
      key: (r) => r.product.title,
      header: 'Medicine',
      sortable: true,
      render: (r) => (
        <span className="row gap-3">
          <ProductThumb product={r.product} />
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{r.product.title}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{r.product.brand} · {r.product.packInfo}</span>
          </span>
        </span>
      ),
    },
    { key: (r) => r.product.category, header: 'Category', sortable: true },
    { key: 'quantity', header: 'On hand', sortable: true, render: (r) => <StockBadge stock={r.quantity} lowThreshold={10} /> },
    {
      key: 'liveLots',
      header: 'Lots',
      align: 'right',
      sortable: true,
      render: (r) => <span className="num">{number(r.liveLots)}</span>,
    },
    {
      key: (r) => r.frontLot?.expiry_date,
      header: 'Sell first (FEFO)',
      sortable: true,
      render: (r) => (r.frontLot ? (
        <span>
          <span className="mono" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{r.frontLot.batch_number}</span>
          <ExpiryBadge date={r.frontLot.expiry_date} dense />
        </span>
      ) : <span className="subtle">No sellable lot</span>),
    },
    { key: (r) => r.product.price, header: 'Sell price', align: 'right', sortable: true, render: (r) => currency(r.product.price) },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => navigate(`/outlet/stock/${r.product._id}`)}>
          View lots
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        sub="What this outlet holds. Assigned by the marketing team, tracked lot by lot."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="Medicines" value={number(stats.skus)} icon="pill" />
        <StatTile label="Units on hand" value={number(stats.units)} icon="box" />
        <StatTile label="Stock at selling price" value={currency(stats.value)} icon="rupee" />
        <StatTile label="Emptied" value={number(stats.empty)} icon="alert"
          tone={stats.empty ? 'warning' : undefined} foot="Assigned but now at zero" />
      </div>

      <Note tone="info" className="section">
        You can only sell from your own shelf — there is no district or warehouse view here. Ask the
        marketing team to assign more stock when a medicine runs low.
      </Note>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search your stock…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(r) => navigate(`/outlet/stock/${r.product._id}`)}
          empty={{
            icon: 'layers',
            title: 'No stock assigned yet',
            text: 'The marketing team assigns stock to this outlet. Once they do, it appears here with its batches.',
          }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="medicines"
        />
      </Card>
    </>
  );
}
