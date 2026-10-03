import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import StatTile from '../../components/common/StatTile';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import ExpiryBadge from '../../features/ExpiryBadge';
import ProductThumb from '../../features/ProductThumb';
import DataTable from '../../components/tables/DataTable';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { getOutletMedicineDetail } from '../../services/outletService';
import { currency, number } from '../../utils/format';
import { formatDate } from '../../utils/dates';
import { expiryTierOf, EXPIRY_TIER } from '../../utils/expiry';

/**
 * "Which lots of this medicine do I actually hold, and what shape are they in?"
 *
 * EVERYTHING here is the server's: the quantities, the batch ORDER (its FEFO
 * order, never re-sorted here) and the totals. This view deliberately shows
 * EVERY lot — expired and emptied included — which the sellable read hides,
 * because a counter needs to know what is on the shelf, not just what it may
 * sell.
 */
export default function OutletMedicineDetail() {
  const { id } = useParams();
  const { outletId } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getOutletMedicineDetail(outletId, id), [outletId, id]);

  if (loading) return <DetailSkeleton back={'/outlet/stock'} crumbs={[{ label: 'Stock', to: '/outlet/stock' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.product) return <ErrorState error={{ message: 'This medicine is not in your stock.' }} />;

  const { product, batches, totalStock, stockMirror, batchCount } = data;
  const sellable = batches.filter((b) => b.available_quantity > 0 && expiryTierOf(b.expiry_date) !== EXPIRY_TIER.EXPIRED);
  const expired = batches.filter((b) => expiryTierOf(b.expiry_date) === EXPIRY_TIER.EXPIRED && b.available_quantity > 0);

  const columns = [
    {
      key: 'batch_number',
      header: 'Batch',
      render: (b) => (
        <span className="row gap-2">
          <span className="mono" style={{ fontWeight: 700 }}>{b.batch_number}</span>
          {b === sellable[0] && <Badge tone="info">Sell first</Badge>}
        </span>
      ),
    },
    { key: 'expiry_date', header: 'Expiry', render: (b) => <ExpiryBadge date={b.expiry_date} showDate /> },
    { key: 'manufacturing_date', header: 'Manufactured', render: (b) => formatDate(b.manufacturing_date) },
    {
      key: 'available_quantity',
      header: 'On hand',
      align: 'right',
      render: (b) => (b.available_quantity === 0
        ? <span className="subtle">Emptied</span>
        : <strong className="num">{number(b.available_quantity)}</strong>),
    },
    { key: 'selling_price', header: 'Sell price', align: 'right', render: (b) => currency(b.selling_price) },
    { key: 'supplier', header: 'Supplier', render: (b) => b.supplier || <span className="subtle">—</span> },
    {
      key: 'status',
      header: 'Status',
      render: (b) => {
        if (expiryTierOf(b.expiry_date) === EXPIRY_TIER.EXPIRED) return <Badge tone="danger" dot>Cannot be sold</Badge>;
        if (b.available_quantity === 0) return <Badge tone="muted">Empty</Badge>;
        return <Badge tone="success" dot>Sellable</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        back="/outlet/stock"
        crumbs={[{ label: 'Stock', to: '/outlet/stock' }, { label: product.title }]}
        title={product.title}
        sub={`${product.brand} · ${product.packInfo}`}
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      {expired.length > 0 && (
        <Note tone="danger" className="section">
          <strong>{expired.length} lot(s) on your shelf have expired</strong> — {number(expired.reduce((s, b) => s + b.available_quantity, 0))} units.
          Expired stock is blocked from billing and must be pulled and written off.
        </Note>
      )}

      <div className="grid grid--kpi section">
        <StatTile label="Units on hand" value={number(totalStock)} icon="box"
          foot={totalStock === stockMirror ? 'Matches the stored total' : `Stored total: ${number(stockMirror)}`} />
        <StatTile label="Lots held" value={number(batchCount)} icon="layers"
          foot={`${sellable.length} sellable`} />
        <StatTile label="Sellable units" value={number(sellable.reduce((s, b) => s + b.available_quantity, 0))} icon="check" tone="info" />
        <StatTile label="Stock at selling price" value={currency(totalStock * product.price)} icon="rupee" />
      </div>

      <div className="split">
        <Card>
          <CardHead
            title="Every lot you hold"
            sub="In the server's FEFO order — nearest expiry first. Expired and emptied lots are shown too."
          />
          <DataTable
            columns={columns}
            rows={batches}
            empty={{ icon: 'layers', title: 'No lots', text: 'This medicine has no batch on your shelf.' }}
          />
        </Card>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <ProductThumb product={product} size="lg" />
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{product.title}</p>
                  <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{product.category}</p>
                </div>
              </div>
              <KeyValue rows={[
                { label: 'MRP', value: currency(product.mrp) },
                { label: 'Selling price', value: currency(product.price) },
                { label: 'GST', value: `${product.gstPercent}% (inclusive)` },
                { label: 'HSN', value: <span className="mono">{product.hsnCode}</span> },
                { label: 'Pack', value: product.packInfo },
                { label: 'Manufacturer', value: product.manufacturer },
                { label: 'Storage', value: product.cold_stored === 'yes' ? 'Cold chain 2–8°C' : 'Below 25°C' },
                {
                  label: 'Prescription',
                  value: product.prescriptionRequired ? <Badge tone="warning">Required</Badge> : 'Not required',
                },
              ]} />
              <Button variant="primary" icon="receipt" block to="/outlet/billing">Bill this medicine</Button>
            </CardBody>
          </Card>

          <Note tone="info">
            Quantities and lot order come straight from the server. Billing always consumes the
            nearest-expiry lot first unless you deliberately pin a different one.
          </Note>
        </div>
      </div>
    </>
  );
}
