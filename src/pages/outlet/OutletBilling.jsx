import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import QtyStepper from '../../components/common/QtyStepper';
import { Input, Select, SearchInput, Textarea } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
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
import { listOutletStock, listOutletAvailableBatches, placeOutletBill, registerOutletVendor } from '../../services/outletService';
import { VENDOR_TYPES, SHOP_TYPES } from '../../constants/catalog';
import { currency, number } from '../../utils/format';
import cn from '../../utils/cn';

/**
 * Counter billing (POS).
 *
 * The app runs this as a 3-step wizard because a phone has no room for more.
 * On a desktop the catalogue and the bill sit side by side — which is what a
 * counter actually needs — and the customer form is a panel rather than a step.
 *
 * The flow reuses the SAME endpoints the app does, in the same order:
 *   1. place the stock-deducting bill (POST /outlet/bill) — the server renders
 *      the invoice and deducts this outlet's batches;
 *   2. file the walk-in customer as a PENDING vendor for the admin approval
 *      flow (POST /outlet/register-vendor), in the background, so a failure
 *      there never blocks the cashier.
 *
 * Money rules from the app hold here too: prices are GST-INCLUSIVE, so the tax
 * is extracted rather than added, and an expired lot can never be billed.
 */
const EMPTY_CUSTOMER = {
  vendor_type: 'Shop / Pharmacy', shop_type: 'Retail Pharmacy',
  store_name: '', contact_person_name: '', mobile_no: '', email: '',
  full_address: '', city: '', state: 'Maharashtra', pin_code: '',
  gst_no: '', drug_lic_no: '',
};

export default function OutletBilling() {
  const { outletId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const stock = useAsync(() => listOutletStock(outletId), [outletId]);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState([]);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [orderType, setOrderType] = useState('COUNTER');
  const [payment, setPayment] = useState('RAZORPAY');
  const [picking, setPicking] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const q = useDebounce(query, 200);

  const results = useMemo(() => {
    const rows = (stock.data || []).filter((r) => r.quantity > 0);
    const term = q.trim().toLowerCase();
    if (!term) return rows.slice(0, 30);
    return rows.filter((r) =>
      [r.product.title, r.product.brand, r.product.code]
        .some((f) => String(f || '').toLowerCase().includes(term))).slice(0, 30);
  }, [stock.data, q]);

  const addLine = async (row) => {
    if (lines.some((l) => l.product._id === row.product._id)) return;
    const lots = await listOutletAvailableBatches(row.product._id);
    if (!lots.length) {
      toast.error(`${row.product.title} has no sellable lot — every batch is empty or expired.`);
      return;
    }
    // Guarded inside the updater: the await above lets two rapid clicks past an
    // outer duplicate check.
    setLines((rows) => (rows.some((l) => l.product._id === row.product._id)
      ? rows
      : [...rows, { product: row.product, quantity: 1, batch: lots[0] }]));
  };

  // GST is EXTRACTED from the inclusive selling price, matching the app's
  // billing review step — it is never added on top.
  const totals = useMemo(() => {
    const gross = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    const mrpTotal = lines.reduce((s, l) => s + (l.product.mrp || l.product.price) * l.quantity, 0);
    const gst = lines.reduce((s, l) => {
      const rate = Number(l.product.gstPercent || 0) / 100;
      const line = l.product.price * l.quantity;
      return s + (rate ? line - line / (1 + rate) : 0);
    }, 0);
    return {
      gross: Math.round(gross * 100) / 100,
      taxable: Math.round((gross - gst) * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      saving: Math.round((mrpTotal - gross) * 100) / 100,
      units: lines.reduce((s, l) => s + l.quantity, 0),
    };
  }, [lines]);

  const validate = () => {
    const e = {};
    if (!customer.store_name.trim()) e.store_name = 'Customer or store name is required';
    if (!/^\d{10}$/.test(customer.mobile_no)) e.mobile_no = 'Enter a 10-digit mobile number';
    if (orderType === 'DELIVERY' && !customer.full_address.trim()) {
      e.full_address = 'A delivery order needs an address';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeBill = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const order = await placeOutletBill({ customer, lines, orderType, paymentMethod: payment });
      toast.success(`${order.orderNo} billed — the invoice is being generated.`);

      // Filed in the background: a failure here must never block the counter.
      registerOutletVendor(customer)
        .then(() => toast.info('Customer filed with admin for vendor approval.'))
        .catch(() => toast.error('Customer registration could not be filed — retry from the order page.'));

      navigate(`/outlet/orders/${order._id}`, { state: { justBilled: true } });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Counter billing"
        sub="Serve a walk-in customer. Stock is deducted from this outlet's lots and the invoice is generated server-side."
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 'var(--sp-4)', alignItems: 'start' }}>
        <div className="stack gap-4">
          <Card>
            <CardHead title="Add from your stock" sub="Only medicines you hold, with a sellable lot" />
            <div className="table-toolbar">
              <SearchInput value={query} onChange={setQuery} placeholder="Search your shelf…" />
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {stock.loading && <div className="state"><Spinner /></div>}
              {!stock.loading && results.length === 0 && (
                <EmptyState icon="pill" title="Nothing to bill" text="No medicine matches, or your shelf is empty." />
              )}
              <table className="table">
                <tbody>
                  {results.map((r) => {
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
                        <td><ExpiryBadge date={r.frontLot?.expiry_date} dense /></td>
                        <td className="cell-num"><span className="num">{number(r.quantity)}</span></td>
                        <td className="cell-num"><strong>{currency(r.product.price)}</strong></td>
                        <td className="cell-actions">
                          <Button size="sm" variant={added ? 'ghost' : 'secondary'} icon={added ? 'check' : 'plus'}
                            disabled={added} onClick={() => addLine(r)}>
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

          <Card>
            <CardHead
              title="Customer details"
              sub="Filed with admin as a pending vendor after the bill — the normal approval flow then continues."
            />
            <CardBody>
              <div className="form-grid">
                <Input label="Customer / store name" required value={customer.store_name}
                  onChange={(e) => setCustomer((c) => ({ ...c, store_name: e.target.value }))} error={errors.store_name} />
                <Input label="Contact person" value={customer.contact_person_name}
                  onChange={(e) => setCustomer((c) => ({ ...c, contact_person_name: e.target.value }))} />
                <Input label="Mobile number" required inputMode="numeric" placeholder="10-digit number"
                  value={customer.mobile_no}
                  onChange={(e) => setCustomer((c) => ({ ...c, mobile_no: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  error={errors.mobile_no} />
                <Input label="Email" type="email" value={customer.email}
                  onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />
                <Select label="Vendor type" options={VENDOR_TYPES} value={customer.vendor_type}
                  onChange={(e) => setCustomer((c) => ({ ...c, vendor_type: e.target.value }))} />
                <Select label="Shop type" options={SHOP_TYPES} value={customer.shop_type}
                  onChange={(e) => setCustomer((c) => ({ ...c, shop_type: e.target.value }))} />
                <Input label="GST number" value={customer.gst_no}
                  onChange={(e) => setCustomer((c) => ({ ...c, gst_no: e.target.value.toUpperCase().slice(0, 15) }))}
                  hint="Recorded as text — no document upload at the counter" />
                <Input label="Drug licence number" value={customer.drug_lic_no}
                  onChange={(e) => setCustomer((c) => ({ ...c, drug_lic_no: e.target.value }))} />
                <Field className="span-2" label="Address" required={orderType === 'DELIVERY'} error={errors.full_address}
                  hint={orderType === 'COUNTER' ? 'Optional for a counter handover' : 'Required for a home delivery'}>
                  <Textarea value={customer.full_address}
                    onChange={(e) => setCustomer((c) => ({ ...c, full_address: e.target.value }))} />
                </Field>
                <Input label="City" value={customer.city}
                  onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))} />
                <Input label="Pincode" inputMode="numeric" value={customer.pin_code}
                  onChange={(e) => setCustomer((c) => ({ ...c, pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Bill" sub={`${lines.length} line(s) · ${number(totals.units)} units`} />
            <CardBody className="stack gap-4">
              {lines.length === 0 ? (
                <EmptyState icon="receipt" title="Nothing on the bill" text="Add medicines from your shelf." />
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
                  { label: 'Taxable value', value: currency(totals.taxable) },
                  { label: 'GST (extracted)', value: currency(totals.gst) },
                  totals.saving > 0 ? { label: 'Customer saves vs MRP', value: `− ${currency(totals.saving)}` } : null,
                  { label: 'Grand total', value: currency(totals.gross), total: true },
                ]} />
              )}

              <Field label="Fulfilment">
                <div className="row gap-2">
                  {[['COUNTER', 'Counter handover'], ['DELIVERY', 'Home delivery']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOrderType(value)}
                      className={cn('chip', orderType === value && 'chip--on')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Payment">
                <div className="row gap-2">
                  {[['RAZORPAY', 'Online / QR'], ['CASH', 'Cash']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPayment(value)}
                      className={cn('chip', payment === value && 'chip--on')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <Button variant="primary" size="lg" block icon="check"
                loading={busy} disabled={lines.length === 0} onClick={placeBill}>
                Place bill · {currency(totals.gross)}
              </Button>

              <p className="subtle text-center" style={{ fontSize: 'var(--fs-xs)' }}>
                Placing the bill deducts your lots and asks the server to render the tax invoice.
              </p>
            </CardBody>
          </Card>

          <Note tone="info">
            Prices are GST-inclusive, so the tax above is extracted from the amount rather than added to it —
            the customer pays exactly the grand total.
          </Note>
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
