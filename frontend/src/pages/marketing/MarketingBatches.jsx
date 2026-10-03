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
import ExpiryBadge from '../../features/ExpiryBadge';
import ProductThumb from '../../features/ProductThumb';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listAllBatches } from '../../services/productService';
import { currency, number } from '../../utils/format';
import { formatDate } from '../../utils/dates';
import { expiryTierOf, EXPIRY_TIER } from '../../utils/expiry';

/**
 * Batch overview — every lot in the catalogue in one table.
 *
 * This has no equivalent screen in the mobile app, where batches are only ever
 * reachable one product at a time. It exists here because a desktop can show
 * the whole inventory at once, which is exactly what "what is about to expire
 * across the catalogue?" needs — and the backend already returns it.
 */
export default function MarketingBatches() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(listAllBatches, []);
  const [risk, setRisk] = useState(null);

  const graded = useMemo(
    () => (data || []).map((b) => ({ ...b, tier: expiryTierOf(b.expiry_date) })),
    [data],
  );

  const scoped = useMemo(() => {
    if (!risk) return graded;
    if (risk === 'atRisk') {
      return graded.filter((b) => [EXPIRY_TIER.CRITICAL, EXPIRY_TIER.WARNING].includes(b.tier) && b.available_quantity > 0);
    }
    if (risk === 'expired') return graded.filter((b) => b.tier === EXPIRY_TIER.EXPIRED);
    if (risk === 'empty') return graded.filter((b) => b.available_quantity === 0);
    return graded;
  }, [graded, risk]);

  const table = useTableControls(scoped, {
    searchKeys: ['batch_number', 'supplier', (b) => b.product?.title, (b) => b.product?.brand],
    initialSort: { key: 'expiry_date', dir: 'asc' },
    pageSize: 20,
  });

  const stats = useMemo(() => {
    const live = graded.filter((b) => b.available_quantity > 0);
    return {
      lots: graded.length,
      units: live.reduce((s, b) => s + b.available_quantity, 0),
      value: live.reduce((s, b) => s + b.available_quantity * (b.purchase_price || 0), 0),
      atRisk: live.filter((b) => [EXPIRY_TIER.CRITICAL, EXPIRY_TIER.WARNING].includes(b.tier)),
      expired: graded.filter((b) => b.tier === EXPIRY_TIER.EXPIRED),
      empty: graded.filter((b) => b.available_quantity === 0).length,
    };
  }, [graded]);

  const atRiskValue = stats.atRisk.reduce((s, b) => s + b.available_quantity * (b.purchase_price || 0), 0);

  const columns = [
    {
      key: (b) => b.product?.title,
      header: 'Medicine',
      sortable: true,
      render: (b) => (
        <span className="row gap-3">
          <ProductThumb product={b.product} />
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{b.product?.title || '—'}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{b.product?.brand}</span>
          </span>
        </span>
      ),
    },
    { key: 'batch_number', header: 'Batch', sortable: true, render: (b) => <span className="mono" style={{ fontWeight: 700 }}>{b.batch_number}</span> },
    { key: 'supplier', header: 'Supplier', sortable: true, render: (b) => b.supplier || <span className="subtle">—</span> },
    { key: 'expiry_date', header: 'Expiry', sortable: true, render: (b) => <ExpiryBadge date={b.expiry_date} showDate /> },
    { key: 'purchase_quantity', header: 'Purchased', align: 'right', sortable: true, render: (b) => number(b.purchase_quantity) },
    {
      key: 'available_quantity',
      header: 'Available',
      align: 'right',
      sortable: true,
      render: (b) => <strong className={b.available_quantity === 0 ? 'subtle' : undefined}>{number(b.available_quantity)}</strong>,
    },
    {
      key: (b) => b.available_quantity * (b.purchase_price || 0),
      header: 'Stock value',
      align: 'right',
      sortable: true,
      render: (b) => currency(b.available_quantity * (b.purchase_price || 0)),
    },
    { key: 'createdAt', header: 'Added', sortable: true, render: (b) => <span className="subtle nowrap">{formatDate(b.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (b) => (
        <Button size="sm" variant="secondary" onClick={() => navigate(`/marketing/products/${b.product_id}`)}>
          Open medicine
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Batch overview"
        sub="Every purchase lot across the whole catalogue, nearest expiry first."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="Lots on record" value={number(stats.lots)} icon="layers" />
        <StatTile label="Units in stock" value={number(stats.units)} icon="box" foot="Across every live lot" />
        <StatTile label="Inventory at cost" value={currency(stats.value)} icon="rupee" foot="Available units × purchase price" />
        <StatTile label="Value at expiry risk" value={currency(atRiskValue)} icon="alert"
          tone={stats.atRisk.length ? 'warning' : undefined}
          foot={`${number(stats.atRisk.length)} lots within 90 days`}
          onClick={() => setRisk(risk === 'atRisk' ? null : 'atRisk')} />
      </div>

      {stats.expired.length > 0 && (
        <Note tone="danger" className="section">
          <strong>{stats.expired.length} lot(s) have passed their expiry date.</strong> Expired stock is blocked
          from sale and never allocated, but it still counts against your shelf until it is written off.
        </Note>
      )}

      <div className="section">
        <Segmented
          value={risk}
          onChange={setRisk}
          options={[
            { key: null, label: 'All lots', count: stats.lots },
            { key: 'atRisk', label: 'Expiring ≤ 90 days', count: stats.atRisk.length },
            { key: 'expired', label: 'Expired', count: stats.expired.length },
            { key: 'empty', label: 'Emptied', count: stats.empty },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by medicine, batch number or supplier…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(b) => navigate(`/marketing/products/${b.product_id}`)}
          empty={{ icon: 'layers', title: 'No lots match', text: 'Try a different filter or clear the search.' }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="lots"
        />
      </Card>
    </>
  );
}
