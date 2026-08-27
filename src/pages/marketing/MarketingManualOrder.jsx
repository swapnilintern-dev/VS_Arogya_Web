import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import QtyStepper from '../../components/common/QtyStepper';
import { SearchInput } from '../../components/forms/Input';
import Icon from '../../components/feedback/Icon';
import Spinner from '../../components/feedback/Spinner';
import EmptyState from '../../components/feedback/EmptyState';
import ProductThumb from '../../features/ProductThumb';
import ExpiryBadge from '../../features/ExpiryBadge';
import StockBadge from '../../features/StockBadge';
import BatchPicker from '../../features/BatchPicker';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { listApprovedVendors } from '../../services/vendorService';
import { listProducts, listAvailableBatches, previewAllocation } from '../../services/productService';
import { placeManualOrder } from '../../services/orderService';
import { currency, number, initials } from '../../utils/format';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';

/**
 * Create a manual order — a vendor phones their order in and marketing places
 * it on their behalf.
 *
 * The app walks four sequential steps because a phone cannot show them at once.
 * A desktop can, so this is a THREE-PANE BUILDER: pick the vendor, search the
 * catalogue, and watch the cart fill on the right. Same workflow, far fewer
 * round trips for someone with a customer on the line.
 *
 * BATCH-AWARE: selecting a medicine loads its sellable lots (FEFO, nearest
 * expiry first) and the nearest lot is pre-selected. Staff may pin a different
 * valid one; the pin travels with the line and the SERVER re-validates it at
 * placement. Nothing here computes inventory.
 *
 * IDEMPOTENT: one clientOrderId is generated per screen and reused across
 * retries, and submit is disabled while a request is in flight — so a
 * double-click or a mid-submit network drop cannot create two orders.
 */
export default function MarketingManualOrder() {
  const navigate = useNavigate();
  const toast = useToast();

  const vendors = useAsync(listApprovedVendors, []);
  const products = useAsync(listProducts, []);

  const [vendor, setVendor] = useState(null);
  const [vendorQuery, setVendorQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState([]);
  const [picking, setPicking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState({});

  // Generated ONCE per screen and reused across retries.
  const clientOrderId = useRef(`web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;

  const vq = useDebounce(vendorQuery, 200);
  const pq = useDebounce(productQuery, 200);

  const vendorResults = useMemo(() => {
    const rows = vendors.data || [];
    const q = vq.trim().toLowerCase();
    if (!q) return rows.slice(0, 40);
    return rows.filter((v) =>
      [v.store_name, v.contact_person_name, v.mobile_no, v.city]
        .some((f) => String(f || '').toLowerCase().includes(q))).slice(0, 40);
  }, [vendors.data, vq]);

  const productResults = useMemo(() => {
    const rows = (products.data || []).filter((p) => p.active);
    const q = pq.trim().toLowerCase();
    if (!q) return rows.slice(0, 40);
    return rows.filter((p) =>
      [p.title, p.brand, p.code, p.category]
        .some((f) => String(f || '').toLowerCase().includes(q))).slice(0, 40);
  }, [products.data, pq]);

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  /**
   * Adding a medicine immediately pins its FEFO front lot.
   *
   * The duplicate check runs INSIDE the state updater, not against the
   * closed-over `lines`: this function awaits the batch fetch first, so two
   * rapid clicks would both pass an outer guard and add the line twice.
   */
  const addLine = async (product) => {
    if (lines.some((l) => l.product._id === product._id)) {
      toast.info(`${product.title} is already on this order.`);
      return;
    }
    const batches = await listAvailableBatches(product._id);
    if (!batches.length) {
      toast.error(`${product.title} has no sellable lot — every batch is empty or expired.`);
      return;
    }
    setLines((rows) => (rows.some((l) => l.product._id === product._id)
      ? rows
      : [...rows, { product, quantity: 1, freeQty: 0, batch: batches[0] }]));
  };

  const setQty = (productId, quantity) =>
    setLines((rows) => rows.map((l) => (l.product._id === productId ? { ...l, quantity } : l)));

  const setFree = (productId, freeQty) =>
    setLines((rows) => rows.map((l) => (l.product._id === productId ? { ...l, freeQty: Math.max(0, freeQty) } : l)));

  const removeLine = (productId) =>
    setLines((rows) => rows.filter((l) => l.product._id !== productId));

  // Re-validate every line against live inventory whenever it changes. This is
  // the server's non-mutating allocate-preview, not a local calculation.
  useEffect(() => {
    let cancelled = false;
    if (!lines.length) { setValidation({}); return undefined; }
    Promise.all(lines.map((l) => previewAllocation({
      productId: l.product._id,
      quantity: l.quantity,
      pinnedBatchId: l.batch?._id,
    }).then((r) => [l.product._id, r]).catch(() => [l.product._id, null])))
      .then((pairs) => { if (!cancelled) setValidation(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [lines]);

  const shortfall = Object.values(validation).some((v) => v && v.remaining > 0);

  const submit = async () => {
    setSubmitting(true);
    try {
      const order = await placeManualOrder({
        vendorId: vendor._id,
        lines: lines.map((l) => ({ ...l, vendor })),
        clientOrderId,
      });
      toast.success(`${order.orderNo} created for ${vendor.store_name}.`);
      navigate(`/marketing/orders/${order._id}`);
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        back="/marketing/orders"
        crumbs={[{ label: 'Orders', to: '/marketing/orders' }, { label: 'Create manual order' }]}
        title="Create manual order"
        sub="Place an order on an approved vendor’s behalf. It enters the normal pipeline as Pending and appears in the vendor’s own panel."
      />

      <div className="grid" style={{ gridTemplateColumns: '300px minmax(0, 1fr) 400px', gap: 'var(--sp-4)', alignItems: 'start' }}>
        {/* ---- Pane 1: vendor -------------------------------------------- */}
        <Card>
          <CardHead title="1 · Vendor" sub={vendor ? 'Selected' : 'Approved vendors only'} />
          <div className="table-toolbar">
            <SearchInput value={vendorQuery} onChange={setVendorQuery} placeholder="Search vendors…" />
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {vendors.loading && <div className="state"><Spinner /></div>}
            {!vendors.loading && vendorResults.length === 0 && (
              <EmptyState icon="store" title="No vendors match" text="Only approved vendors can be ordered for." />
            )}
            <div className="stack" style={{ padding: 'var(--sp-2)' }}>
              {vendorResults.map((v) => (
                <button
                  key={v._id}
                  type="button"
                  onClick={() => setVendor(v)}
                  className="row gap-3"
                  style={{
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderRadius: 'var(--r-md)',
                    textAlign: 'left',
                    background: vendor?._id === v._id ? 'var(--brand-100)' : 'transparent',
                  }}
                >
                  <span className="avatar avatar--sm">{initials(v.store_name)}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{v.store_name}</span>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{v.city} · {v.mobile_no}</span>
                  </span>
                  {vendor?._id === v._id && <Icon name="check" size={14} strokeWidth={2.6} />}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ---- Pane 2: catalogue ----------------------------------------- */}
        <Card>
          <CardHead title="2 · Add medicines" sub="Live catalogue stock — the FEFO front lot is pinned automatically" />
          <div className="table-toolbar">
            <SearchInput value={productQuery} onChange={setProductQuery} placeholder="Search by name, brand, SKU or category…" />
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {products.loading && <div className="state"><Spinner /></div>}
            {!products.loading && productResults.length === 0 && (
              <EmptyState icon="pill" title="No medicines match" text="Try a different search term." />
            )}
            <table className="table">
              <tbody>
                {productResults.map((p) => {
                  const added = lines.some((l) => l.product._id === p._id);
                  const out = stockStatusOf(p.stock, p.lowThreshold) === STOCK_STATUS.OUT;
                  return (
                    <tr key={p._id}>
                      <td>
                        <span className="row gap-3">
                          <ProductThumb product={p} />
                          <span style={{ minWidth: 0 }}>
                            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{p.title}</span>
                            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{p.brand} · {p.packInfo}</span>
                          </span>
                        </span>
                      </td>
                      <td><StockBadge stock={p.stock} lowThreshold={p.lowThreshold} /></td>
                      <td className="cell-num"><strong>{currency(p.price)}</strong></td>
                      <td className="cell-actions">
                        <Button
                          size="sm"
                          variant={added ? 'ghost' : 'secondary'}
                          icon={added ? 'check' : 'plus'}
                          disabled={added || out}
                          onClick={() => addLine(p)}
                        >
                          {added ? 'Added' : out ? 'Out' : 'Add'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ---- Pane 3: the order ----------------------------------------- */}
        <div className="rail">
          <Card>
            <CardHead title="3 · Review & place" sub={`${lines.length} line(s)`} />
            <CardBody className="stack gap-4">
              {!vendor && <Note tone="info">Pick a vendor to start.</Note>}
              {vendor && (
                <div className="row gap-3">
                  <span className="avatar">{initials(vendor.store_name)}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 700 }}>{vendor.store_name}</span>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                      {vendor.full_address}, {vendor.city} · {vendor.pin_code}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" icon="x" onClick={() => setVendor(null)} aria-label="Clear vendor" />
                </div>
              )}

              {lines.length === 0 ? (
                <EmptyState icon="cart" title="No medicines yet" text="Search the catalogue and add what the vendor asked for." />
              ) : (
                <div className="stack gap-3">
                  {lines.map((l) => {
                    const check = validation[l.product._id];
                    const short = check && check.remaining > 0;
                    return (
                      <div
                        key={l.product._id}
                        className="stack gap-2"
                        style={{
                          padding: 'var(--sp-3)',
                          border: `1px solid ${short ? 'var(--danger)' : 'var(--border)'}`,
                          borderRadius: 'var(--r-md)',
                          background: short ? 'var(--danger-bg)' : 'var(--surface)',
                        }}
                      >
                        <div className="row gap-3">
                          <ProductThumb product={l.product} />
                          <span className="grow" style={{ minWidth: 0 }}>
                            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{l.product.title}</span>
                            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{currency(l.product.price)} each</span>
                          </span>
                          <Button size="sm" variant="ghost" icon="trash" onClick={() => removeLine(l.product._id)} aria-label="Remove line" />
                        </div>

                        <button
                          type="button"
                          className="row gap-2 between"
                          onClick={() => setPicking(l)}
                          style={{
                            padding: '6px var(--sp-3)',
                            background: 'var(--surface-sunken)',
                            borderRadius: 'var(--r-sm)',
                            width: '100%',
                          }}
                        >
                          <span className="row gap-2" style={{ minWidth: 0 }}>
                            <Icon name="layers" size={13} />
                            <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>
                              {l.batch?.batch_number || 'No lot'}
                            </span>
                            <ExpiryBadge date={l.batch?.expiry_date} dense />
                          </span>
                          <span className="row gap-1 subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                            Change <Icon name="chevronRight" size={11} />
                          </span>
                        </button>

                        <div className="between">
                          <span className="row gap-3">
                            <QtyStepper
                              size="sm"
                              value={l.quantity}
                              max={l.product.stock}
                              onChange={(q) => setQty(l.product._id, q)}
                              onRemove={() => removeLine(l.product._id)}
                            />
                            <label className="row gap-2" title="Free goods — handed over at no charge, never priced">
                              <span className="subtle" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>FREE</span>
                              <input
                                className="input"
                                inputMode="numeric"
                                value={l.freeQty}
                                onChange={(e) => setFree(l.product._id, Number(e.target.value.replace(/\D/g, '') || 0))}
                                style={{ width: 52, minHeight: 28, padding: '2px 6px', textAlign: 'center' }}
                              />
                            </label>
                          </span>
                          <strong>{currency(l.product.price * l.quantity)}</strong>
                        </div>

                        {short && (
                          <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--danger-strong)' }}>
                            Only {number(l.quantity - check.remaining)} units can be allocated — {number(check.remaining)} short across every lot.
                          </p>
                        )}
                        {check?.allocations?.length > 1 && !short && (
                          <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                            Spans {check.allocations.length} lots: {check.allocations.map((a) => `${a.batch_number}×${a.quantity}`).join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {lines.length > 0 && (
                <KeyValue rows={[
                  { label: 'Lines', value: number(lines.length) },
                  { label: 'Units', value: number(lines.reduce((s, l) => s + l.quantity, 0)) },
                  {
                    label: 'Free goods',
                    value: lines.reduce((s, l) => s + l.freeQty, 0)
                      ? `${number(lines.reduce((s, l) => s + l.freeQty, 0))} units (not charged)`
                      : '—',
                  },
                  { label: 'Order total', value: currency(total), total: true },
                ]} />
              )}

              {shortfall && (
                <Note tone="danger">
                  One or more lines cannot be fully allocated from live stock. Reduce the quantity or pick a
                  different lot before placing the order.
                </Note>
              )}

              <Button
                variant="primary"
                size="lg"
                block
                icon="check"
                loading={submitting}
                disabled={!vendor || lines.length === 0 || shortfall}
                onClick={submit}
              >
                Place order
              </Button>

              <p className="subtle text-center" style={{ fontSize: 'var(--fs-xs)' }}>
                Submitted once — the request carries a stable idempotency key, so a retry can never create a
                duplicate order.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {picking && (
        <BatchPicker
          productName={picking.product.title}
          fetchBatches={() => listAvailableBatches(picking.product._id)}
          selectedBatchId={picking.batch?._id}
          onSelect={(batch) => setLines((rows) => rows.map((l) =>
            (l.product._id === picking.product._id
              ? { ...l, batch, quantity: Math.min(l.quantity, batch.available_quantity) }
              : l)))}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
