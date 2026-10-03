import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Segmented from '../../components/common/Segmented';
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
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { listProducts, updateProduct, deleteProduct } from '../../services/productService';
import { categoriesOf, sameCategory } from '../../utils/categories';
import { currency, number } from '../../utils/format';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';

/**
 * The medicine inventory — the marketing head's main working surface.
 *
 * The app's rich cards become a dense table because that is what actually
 * scales on a desktop: stock, expiry, price and visibility are all comparable
 * at a glance across dozens of rows, which a card wall cannot do.
 */
export default function MarketingProducts() {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(listProducts, []);

  const [visibility, setVisibility] = useState(null);
  const [category, setCategory] = useState(null);
  const [stockFilter, setStockFilter] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const scoped = useMemo(() => {
    let rows = data || [];
    if (visibility === 'active') rows = rows.filter((p) => p.active);
    if (visibility === 'inactive') rows = rows.filter((p) => !p.active);
    if (category) rows = rows.filter((p) => sameCategory(p.category, category));
    if (stockFilter) rows = rows.filter((p) => stockStatusOf(p.stock, p.lowThreshold) === stockFilter);
    return rows;
  }, [data, visibility, category, stockFilter]);

  const table = useTableControls(scoped, {
    searchKeys: ['title', 'brand', 'code', 'manufacturer', 'batch_no'],
    initialSort: { key: 'title', dir: 'asc' },
    pageSize: 15,
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

  const toggleActive = async (p) => {
    setBusyId(p._id);
    try {
      await updateProduct(p._id, { active: !p.active });
      setData((rows) => rows.map((r) => (r._id === p._id ? { ...r, active: !r.active } : r)));
      toast.success(`${p.title} is now ${p.active ? 'hidden from' : 'visible to'} vendors.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: `Delete ${p.title}?`,
      message: 'The medicine and every batch under it are removed from the catalogue. Existing orders keep their snapshotted line items, but the SKU can no longer be ordered. This cannot be undone.',
      confirmLabel: 'Delete medicine',
    });
    if (!ok) return;
    try {
      await deleteProduct(p._id);
      setData((rows) => rows.filter((r) => r._id !== p._id));
      toast.success('Medicine deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Medicine',
      sortable: true,
      render: (p) => (
        <span className="row gap-3">
          <ProductThumb product={p} />
          <span style={{ minWidth: 0 }}>
            <span className="row gap-2">
              <span className="truncate" style={{ fontWeight: 600 }}>{p.title}</span>
              {p.prescriptionRequired && <Badge tone="warning">Rx</Badge>}
              {p.cold_stored === 'yes' && <Badge tone="info">2–8°C</Badge>}
            </span>
            <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
              {p.brand} · {p.packInfo}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'code', header: 'SKU', sortable: true, render: (p) => <span className="mono">{p.code}</span> },
    { key: 'category', header: 'Category', sortable: true },
    {
      key: 'price',
      header: 'Pricing',
      align: 'right',
      sortable: true,
      render: (p) => (
        <span>
          <strong style={{ display: 'block' }}>{currency(p.price)}</strong>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            MRP {currency(p.mrp)}{p.discountPercent ? ` · ${p.discountPercent}% off` : ''}
          </span>
          {(Number(p.drDisPercent) > 0 || Number(p.wholesellerPercent) > 0) && (
            <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
              {Number(p.drDisPercent) > 0 && `Dr ${Number(p.drDisPercent)}%`}
              {Number(p.drDisPercent) > 0 && Number(p.wholesellerPercent) > 0 && ' · '}
              {Number(p.wholesellerPercent) > 0 && `WS ${Number(p.wholesellerPercent)}%`}
            </span>
          )}
        </span>
      ),
    },
    { key: 'stock', header: 'Stock', sortable: true, render: (p) => <StockBadge stock={p.stock} lowThreshold={p.lowThreshold} /> },
    {
      key: 'exp_date',
      header: 'FEFO front lot',
      sortable: true,
      render: (p) => (
        <span>
          <span className="mono" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{p.batch_no || '—'}</span>
          <ExpiryBadge date={p.exp_date} dense />
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Visibility',
      sortable: true,
      render: (p) => <Badge tone={p.active ? 'success' : 'muted'} dot>{p.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (p) => (
        <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" loading={busyId === p._id} onClick={() => toggleActive(p)}>
            {p.active ? 'Hide' : 'Publish'}
          </Button>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => navigate(`/marketing/products/${p._id}`)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(p)} aria-label="Delete medicine" />
        </span>
      ),
    },
  ];

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Medicine inventory"
        sub="Every SKU vendors and outlets order from. Stock is the sum of a medicine’s batches — edit lots, not the total."
        actions={(
          <>
            <Button icon="layers" to="/marketing/batches">Batch overview</Button>
            <Button icon="file" to="/marketing/products/bulk">Bulk upload</Button>
            <Button variant="primary" icon="plus" to="/marketing/products/new">Add medicine</Button>
          </>
        )}
      />

      <div className="grid grid--kpi section">
        <StatTile label="Total SKUs" value={number(stats.total)} icon="pill" />
        <StatTile label="Active" value={number(stats.active)} icon="check"
          foot={`${stats.total - stats.active} hidden from vendors`}
          onClick={() => setVisibility('active')} />
        <StatTile label="Low stock" value={number(stats.low)} icon="alert" tone="warning"
          foot="At or below reorder threshold"
          onClick={() => setStockFilter(stockFilter === STOCK_STATUS.LOW ? null : STOCK_STATUS.LOW)} />
        <StatTile label="Out of stock" value={number(stats.out)} icon="x" tone="danger"
          foot="Cannot be ordered"
          onClick={() => setStockFilter(stockFilter === STOCK_STATUS.OUT ? null : STOCK_STATUS.OUT)} />
      </div>

      <div className="stack gap-3 section">
        <div className="row gap-3 wrap">
          <Segmented
            value={visibility}
            onChange={setVisibility}
            options={[
              { key: null, label: 'All', count: stats.total },
              { key: 'active', label: 'Active', count: stats.active },
              { key: 'inactive', label: 'Inactive', count: stats.total - stats.active },
            ]}
          />
          {stockFilter && (
            <Button size="sm" variant="ghost" icon="x" onClick={() => setStockFilter(null)}>
              Clear stock filter
            </Button>
          )}
        </div>
        <div className="row gap-2 wrap">
          <Chip active={!category} onClick={() => setCategory(null)} count={data?.length ?? 0}>All categories</Chip>
          {categoriesOf(data).map((c) => (
            <Chip key={c} active={sameCategory(category, c)} onClick={() => setCategory(sameCategory(category, c) ? null : c)}
              count={(data || []).filter((p) => sameCategory(p.category, c)).length}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <Card>
        <TableToolbar
          query={table.query}
          onQuery={table.setQuery}
          placeholder="Search by name, brand, SKU, manufacturer or batch…"
          right={<span className="subtle nowrap">{number(table.total)} shown</span>}
        />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          onRowClick={(p) => navigate(`/marketing/products/${p._id}`)}
          empty={{
            icon: 'pill',
            title: 'No medicines match',
            text: 'Clear the filters, or add the first medicine to this category.',
            action: <Button variant="primary" icon="plus" to="/marketing/products/new">Add medicine</Button>,
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
