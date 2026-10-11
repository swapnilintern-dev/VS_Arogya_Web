import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Chip from '../../components/common/Chip';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import StockBadge from '../../features/StockBadge';
import ExpiryBadge from '../../features/ExpiryBadge';
import ProductThumb from '../../features/ProductThumb';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listProducts } from '../../services/productService';
import { categoriesOf, sameCategory } from '../../utils/categories';
import { currency, number } from '../../utils/format';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';

/**
 * The master catalogue as Admin sees it — the SAME list the customer shop sells
 * from (GET /all-products). Read-only oversight: product authoring belongs to
 * the Marketing role, which owns the media and batch workflows.
 */
export default function AdminProducts() {
  const { data, loading, error, reload } = useAsync(listProducts, []);
  const [category, setCategory] = useState(null);

  const scoped = useMemo(
    () => (category ? (data || []).filter((p) => sameCategory(p.category, category)) : data || []),
    [data, category],
  );

  const table = useTableControls(scoped, {
    searchKeys: ['title', 'brand', 'code', 'manufacturer'],
    initialSort: { key: 'title', dir: 'asc' },
  });

  const stats = useMemo(() => {
    const rows = data || [];
    return {
      total: rows.length,
      active: rows.filter((p) => p.active).length,
      low: rows.filter((p) => stockStatusOf(p.stock, p.lowThreshold) === STOCK_STATUS.LOW).length,
      out: rows.filter((p) => stockStatusOf(p.stock, p.lowThreshold) === STOCK_STATUS.OUT).length,
    };
  }, [data]);

  const columns = [
    {
      key: 'title',
      header: 'Medicine',
      sortable: true,
      render: (p) => (
        <span className="row gap-3">
          <ProductThumb product={p} />
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{p.title}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{p.brand} · {p.packInfo}</span>
          </span>
        </span>
      ),
    },
    { key: 'code', header: 'SKU', sortable: true, render: (p) => <span className="mono">{p.code}</span> },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'mrp', header: 'MRP', align: 'right', sortable: true, render: (p) => currency(p.mrp) },
    { key: 'price', header: 'Sell price', align: 'right', sortable: true, render: (p) => <strong>{currency(p.price)}</strong> },
    {
      key: 'drDisPercent',
      header: 'Rate cards',
      render: (p) => {
        const dr = Number(p.drDisPercent) || 0;
        const ws = Number(p.wholesellerPercent) || 0;
        if (!dr && !ws) return <span className="subtle">Retail only</span>;
        return (
          <span className="row gap-2 wrap">
            {dr > 0 && <Badge tone="accent">Dr {dr}%</Badge>}
            {ws > 0 && <Badge tone="info">WS {ws}%</Badge>}
          </span>
        );
      },
    },
    { key: 'stock', header: 'Stock', sortable: true, render: (p) => <StockBadge stock={p.stock} lowThreshold={p.lowThreshold} /> },
    { key: 'exp_date', header: 'Front lot expiry', sortable: true, render: (p) => <ExpiryBadge date={p.exp_date} dense showDate /> },
    {
      key: 'active',
      header: 'Visibility',
      sortable: true,
      render: (p) => (
        <span className="row gap-2">
          <Badge tone={p.active ? 'success' : 'muted'} dot>{p.active ? 'Active' : 'Inactive'}</Badge>
          {p.prescriptionRequired && <Badge tone="warning">Rx</Badge>}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Catalogue"
        sub="Every SKU on the platform — the same list vendors order from. Product authoring lives with the Marketing role."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="Total SKUs" value={number(stats.total)} icon="pill" />
        <StatTile label="Active" value={number(stats.active)} icon="check" foot="Visible to vendors" />
        <StatTile label="Low stock" value={number(stats.low)} icon="alert" tone="warning" foot="At or below reorder threshold" />
        <StatTile label="Out of stock" value={number(stats.out)} icon="x" tone="danger" foot="Cannot be ordered" />
      </div>

      <div className="row gap-2 wrap section">
        <Chip active={!category} onClick={() => setCategory(null)} count={data?.length ?? 0}>All categories</Chip>
        {categoriesOf(data).map((c) => (
          <Chip
            key={c}
            active={sameCategory(category, c)}
            onClick={() => setCategory(c)}
            count={(data || []).filter((p) => sameCategory(p.category, c)).length}
          >
            {c}
          </Chip>
        ))}
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by name, brand, SKU or manufacturer…" />
        <DataTable
          columns={columns}
          rows={table.rows}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={table.sort}
          onSort={table.toggleSort}
          empty={{ icon: 'pill', title: 'No medicines match', text: 'Clear the search or pick a different category.' }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="SKUs"
        />
      </Card>
    </>
  );
}
