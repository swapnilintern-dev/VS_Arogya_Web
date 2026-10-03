import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import QtyStepper from '../../components/common/QtyStepper';
import { SearchInput } from '../../components/forms/Input';
import Icon from '../../components/feedback/Icon';
import Spinner from '../../components/feedback/Spinner';
import EmptyState from '../../components/feedback/EmptyState';
import ProductThumb from '../../features/ProductThumb';
import ExpiryBadge from '../../features/ExpiryBadge';
import BatchPicker from '../../features/BatchPicker';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { listOutletStock, listOutletAvailableBatches, previewOutletAllocation } from '../../services/outletService';
import { listApprovedVendors } from '../../services/vendorService';
import { placeManualOrder } from '../../services/orderService';
import { currency, number, initials } from '../../utils/format';

/**
 * Place an order for a REGISTERED vendor out of this outlet's stock.
 *
 * Distinct from counter billing: that serves a walk-in and files them as a new
 * pending vendor; this one serves an already-approved vendor and the order
 * enters the normal pipeline for the team to accept, invoice and fulfil.
 *
 * Every line is pinned to a lot, re-validated against live inventory by the
 * server (non-mutating preview) before anything is committed, and the request
 * carries a stable idempotency key.
 */
export default function OutletManualOrder() {
  const { outletId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const stock = useAsync(() => listOutletStock(outletId), [outletId]);
  const vendors = useAsync(listApprovedVendors, []);

  const [vendor, setVendor] = useState(null);
  const [vendorQuery, setVendorQuery] = useState('');
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState([]);
  const [picking, setPicking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const idempotencyKey = useRef(`outlet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;

  const vq = useDebounce(vendorQuery, 200);
  const q = useDebounce(query, 200);

  const vendorResults = useMemo(() => {
    const rows = vendors.data || [];
    const term = vq.trim().toLowerCase();
    if (!term) return rows.slice(0, 30);
    return rows.filter((v) => [v.store_name, v.mobile_no, v.city]
      .some((f) => String(f || '').toLowerCase().includes(term))).slice(0, 30);
  }, [vendors.data, vq]);

  const stockResults = useMemo(() => {
    const rows = (stock.data || []).filter((r) => r.quantity > 0);
    const term = q.trim().toLowerCase();
    if (!term) return rows.slice(0, 30);
    return rows.filter((r) => [r.product.title, r.product.brand]
      .some((f) => String(f || '').toLowerCase().includes(term))).slice(0, 30);
  }, [stock.data, q]);

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const addLine = async (row) => {
    if (lines.some((l) => l.product._id === row.product._id)) return;
    const lots = await listOutletAvailableBatches(row.product._id);
    if (!lots.length) { toast.error(`${row.product.title} has no sellable lot.`); return; }
    // Guarded inside the updater (see the note in OutletBilling.addLine).
    setLines((rows) => (rows.some((l) => l.product._id === row.product._id)
      ? rows
      : [...rows, { product: row.product, quantity: 1, batch: lots[0] }]));
  };

  const submit = async () => {
    // The server re-checks every line against live inventory before anything is
    // committed — stock, batch validity, expiry and this outlet's ownership.
    setChecking(true);
    try {
      const checks = await Promise.all(lines.map((l) => previewOutletAllocation({
        productId: l.product._id,
        quantity: l.quantity,
        pinnedBatchId: l.batch?._id,
      })));
      const short = checks.findIndex((c) => c.remaining > 0);
      if (short >= 0) {
        toast.error(`${lines[short].product.title}: only ${lines[short].quantity - checks[short].remaining} units can be issued.`);
        return;
      }
    } finally {
      setChecking(false);
    }

    setBusy(true);
    try {
      const order = await placeManualOrder({
        vendorId: vendor._id,
        lines: lines.map((l) => ({ ...l, vendor })),
        clientOrderId: idempotencyKey,
        outletId,
      });
      toast.success(`${order.orderNo} created for ${vendor.store_name}.`);
      navigate(`/outlet/orders/${order._id}`);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        back="/outlet/orders"
        crumbs={[{ label: 'Orders', to: '/outlet/orders' }, { label: 'Manual order' }]}
        title="Manual order"
        sub="Order for an approved vendor out of this outlet's stock. It enters the normal pipeline."
      />

      <Note tone="info" className="section">
        For a walk-in customer use <strong>Counter billing</strong> instead — that files the customer as a new
        vendor and issues the bill immediately. This screen is for a vendor who is already approved.
      </Note>

      <div className="grid" style={{ gridTemplateColumns: '290px minmax(0, 1fr) 380px', gap: 'var(--sp-4)', alignItems: 'start' }}>
        <Card>
          <CardHead title="1 · Vendor" />
          <div className="table-toolbar">
            <SearchInput value={vendorQuery} onChange={setVendorQuery} placeholder="Search vendors…" />
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto', padding: 'var(--sp-2)' }}>
            {vendors.loading && <div className="state"><Spinner /></div>}
            {!vendors.loading && vendorResults.length === 0 && (
              <EmptyState icon="store" title="No vendor matches" text="Only approved vendors can be ordered for." />
            )}
            {vendorResults.map((v) => (
              <button
                key={v._id}
                type="button"
                onClick={() => setVendor(v)}
                className="row gap-3"
                style={{
                  width: '100%', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', textAlign: 'left',
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
        </Card>

        <Card>
          <CardHead title="2 · Your stock" sub="Only what this outlet holds" />
          <div className="table-toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search your shelf…" />
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {stock.loading && <div className="state"><Spinner /></div>}
            {!stock.loading && stockResults.length === 0 && (
              <EmptyState icon="pill" title="Nothing available" text="No medicine matches, or your shelf is empty." />
            )}
            <table className="table">
              <tbody>
                {stockResults.map((r) => {
                  const added = lines.some((l) => l.product._id === r.product._id);
                  return (
                    <tr key={r.product._id}>
                      <td>
                        <span className="row gap-3">
                          <ProductThumb product={r.product} />
                          <span style={{ minWidth: 0 }}>
                            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{r.product.title}</span>
                            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{r.product.packInfo}</span>
                          </span>
                        </span>
                      </td>
                      <td className="cell-num"><span className="num">{number(r.quantity)}</span></td>
                      <td className="cell-num"><strong>{currency(r.product.price)}</strong></td>
                      <td className="cell-actions">
                        <Button size="sm" variant={added ? 'ghost' : 'secondary'} icon={added ? 'check' : 'plus'}
                          disabled={added || !vendor} onClick={() => addLine(r)}>
                          {added ? 'Added' : 'Add'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="3 · Review" sub={`${lines.length} line(s)`} />
            <CardBody className="stack gap-4">
              {!vendor && <Note tone="info">Pick the vendor this order is for.</Note>}

              {lines.length === 0 ? (
                <EmptyState icon="cart" title="Nothing added" text="Add medicines from your shelf." />
              ) : (
                <div className="stack gap-3">
                  {lines.map((l) => (
                    <div key={l.product._id} className="stack gap-2"
                      style={{ padding: 'var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                      <div className="row gap-3">
                        <span className="grow truncate" style={{ fontWeight: 600 }}>{l.product.title}</span>
                        <Button size="sm" variant="ghost" icon="trash"
                          onClick={() => setLines((rows) => rows.filter((r) => r.product._id !== l.product._id))}
                          aria-label="Remove line" />
                      </div>
                      <button type="button" className="between" onClick={() => setPicking(l)}
                        style={{ padding: '5px var(--sp-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', width: '100%' }}>
                        <span className="row gap-2" style={{ minWidth: 0 }}>
                          <Icon name="layers" size={12} />
                          <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{l.batch?.batch_number}</span>
                          <ExpiryBadge date={l.batch?.expiry_date} dense />
                        </span>
                        <Icon name="chevronRight" size={11} />
                      </button>
                      <div className="between">
                        <QtyStepper
                          size="sm"
                          value={l.quantity}
                          max={l.batch?.available_quantity || 0}
                          onChange={(qty) => setLines((rows) => rows.map((r) =>
                            (r.product._id === l.product._id ? { ...r, quantity: qty } : r)))}
                          onRemove={() => setLines((rows) => rows.filter((r) => r.product._id !== l.product._id))}
                        />
                        <strong>{currency(l.product.price * l.quantity)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {lines.length > 0 && (
                <KeyValue rows={[
                  { label: 'Vendor', value: vendor?.store_name || '—' },
                  { label: 'Units', value: number(lines.reduce((s, l) => s + l.quantity, 0)) },
                  { label: 'Order total', value: currency(total), total: true },
                ]} />
              )}

              <Button variant="primary" size="lg" block icon="check"
                loading={busy || checking}
                disabled={!vendor || lines.length === 0}
                onClick={submit}>
                {checking ? 'Checking stock…' : 'Create order'}
              </Button>

              <p className="subtle text-center" style={{ fontSize: 'var(--fs-xs)' }}>
                Every line is re-checked against live inventory before anything is committed. The request
                carries a stable key, so a retry can never create a duplicate.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {picking && (
        <BatchPicker
          productName={picking.product.title}
          fetchBatches={() => listOutletAvailableBatches(picking.product._id)}
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
