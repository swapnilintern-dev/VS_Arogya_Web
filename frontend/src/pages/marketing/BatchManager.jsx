import { useMemo, useState } from 'react';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Note from '../../components/common/Note';
import StatTile from '../../components/common/StatTile';
import { Input } from '../../components/forms/Input';
import BatchTable from '../../features/BatchTable';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { listBatches, createBatch, updateBatch, deleteBatch } from '../../services/productService';
import { currency, number } from '../../utils/format';
import { toInputDate } from '../../utils/dates';
import { expiryTierOf, EXPIRY_TIER } from '../../utils/expiry';

/**
 * Batch manager — a port of lib/marketing/batch_manager.dart.
 *
 * Every PURCHASE is a brand-new lot, never a new product and never an edit to
 * the total. The product's stock is always the SUM of its lots' available
 * quantities, recomputed by the backend on every change and echoed back here.
 */
const EMPTY_BATCH = {
  batch_number: '', purchase_quantity: '', available_quantity: '',
  purchase_price: '', selling_price: '', manufacturing_date: '', expiry_date: '', supplier: '',
};

export default function BatchManager({ productId, product, onStockChanged }) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const { data, loading, error, reload } = useAsync(() => listBatches(productId), [productId]);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_BATCH);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const rows = data || [];
    const available = rows.reduce((s, b) => s + Number(b.available_quantity || 0), 0);
    const value = rows.reduce((s, b) => s + Number(b.available_quantity || 0) * Number(b.purchase_price || 0), 0);
    const atRisk = rows.filter((b) => b.available_quantity > 0
      && [EXPIRY_TIER.EXPIRED, EXPIRY_TIER.CRITICAL, EXPIRY_TIER.WARNING].includes(expiryTierOf(b.expiry_date)));
    return {
      lots: rows.length,
      available,
      value,
      atRisk: atRisk.length,
      atRiskUnits: atRisk.reduce((s, b) => s + b.available_quantity, 0),
    };
  }, [data]);

  const open = (batch) => {
    setEditing(batch || 'new');
    setErrors({});
    setForm(batch ? {
      ...batch,
      manufacturing_date: toInputDate(batch.manufacturing_date),
      expiry_date: toInputDate(batch.expiry_date),
    } : { ...EMPTY_BATCH, selling_price: product?.price ?? '' });
  };

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.batch_number.trim()) e.batch_number = 'The batch number printed on the pack is required';
    else if ((data || []).some((b) => b.batch_number === form.batch_number.trim() && b._id !== form._id)) {
      e.batch_number = 'This medicine already has a lot with that number';
    }
    const qty = Number(form.purchase_quantity);
    if (!qty || qty <= 0) e.purchase_quantity = 'Enter how many units were purchased';
    const available = form.available_quantity === '' ? qty : Number(form.available_quantity);
    if (available < 0) e.available_quantity = 'Available units cannot be negative';
    if (available > qty) e.available_quantity = 'Available cannot exceed the purchased quantity';
    if (!form.expiry_date) e.expiry_date = 'An expiry date is required for FEFO allocation';
    if (form.manufacturing_date && form.expiry_date && form.manufacturing_date >= form.expiry_date) {
      e.expiry_date = 'Expiry must be after the manufacturing date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = {
        batch_number: form.batch_number.trim(),
        purchase_quantity: Number(form.purchase_quantity),
        available_quantity: form.available_quantity === '' ? Number(form.purchase_quantity) : Number(form.available_quantity),
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        manufacturing_date: form.manufacturing_date || undefined,
        expiry_date: form.expiry_date || undefined,
        supplier: form.supplier.trim(),
      };
      if (editing === 'new') {
        await createBatch(productId, payload);
        toast.success('Batch added — stock recalculated.');
      } else {
        await updateBatch(form._id, payload);
        toast.success('Batch updated — stock recalculated.');
      }
      setEditing(null);
      reload();
      onStockChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (batch) => {
    const ok = await confirm({
      title: `Delete batch ${batch.batch_number}?`,
      message: batch.available_quantity > 0
        ? `This lot still holds ${batch.available_quantity} units. Deleting it removes those units from the medicine's stock. This cannot be undone.`
        : 'This lot is already empty. Deleting it removes it from the history for this medicine.',
      confirmLabel: 'Delete batch',
    });
    if (!ok) return;
    try {
      await deleteBatch(batch._id);
      toast.success('Batch deleted — stock recalculated.');
      reload();
      onStockChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      {confirmUi}

      <div className="grid grid--kpi section stagger">
        <StatTile label="Lots on record" value={number(stats.lots)} icon="layers" />
        <StatTile label="Units available" value={number(stats.available)} icon="box"
          foot="This is the medicine’s stock figure" />
        <StatTile label="Stock at cost" value={currency(stats.value)} icon="rupee"
          foot="Available units × purchase price" />
        <StatTile label="Expiring within 90 days" value={number(stats.atRisk)} icon="alert"
          tone={stats.atRisk ? 'warning' : undefined}
          foot={stats.atRisk ? `${number(stats.atRiskUnits)} units at risk` : 'Nothing at risk'} />
      </div>

      <Note tone="info" className="section">
        Stock is consumed <strong>FEFO</strong> — first expiry, first out. The nearest-expiry lot is sold
        first, and a single order line can span several lots when one cannot cover it. Never adjust a
        medicine’s stock directly: add the purchase as a new lot instead.
      </Note>

      <Card>
        <CardHead
          title="Batches"
          sub="One row per purchase, with its own quantity, expiry and pricing"
          actions={(
            <>
              <Button size="sm" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
              <Button size="sm" variant="primary" icon="plus" onClick={() => open(null)}>Add batch</Button>
            </>
          )}
        />
        <BatchTable
          batches={data}
          loading={loading}
          error={error}
          onRetry={reload}
          onEdit={open}
          onDelete={remove}
        />
      </Card>

      {editing && (
        <Modal
          size="lg"
          title={editing === 'new' ? 'Add batch' : `Edit batch ${form.batch_number}`}
          sub={product?.title}
          onClose={() => setEditing(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
              <Button variant="primary" icon="check" loading={busy} onClick={save}>
                {editing === 'new' ? 'Add batch' : 'Save batch'}
              </Button>
            </>
          )}
        >
          <div className="form-grid">
            <Input label="Batch number" required placeholder="As printed on the pack"
              value={form.batch_number} onChange={set('batch_number')} error={errors.batch_number} />
            <Input label="Supplier" placeholder="Who this lot was bought from"
              value={form.supplier} onChange={set('supplier')} />
            <Input label="Purchased quantity" required type="number" min="0"
              value={form.purchase_quantity} onChange={set('purchase_quantity')} error={errors.purchase_quantity}
              hint="Immutable reference — how many units this lot arrived with" />
            <Input label="Available quantity" type="number" min="0"
              value={form.available_quantity} onChange={set('available_quantity')} error={errors.available_quantity}
              hint={editing === 'new' ? 'Defaults to the purchased quantity' : 'FEFO decrements this as stock is sold'} />
            <Input label="Purchase price" type="number" min="0" step="0.01"
              value={form.purchase_price} onChange={set('purchase_price')} hint="Per unit, what you paid" />
            <Input label="Selling price" type="number" min="0" step="0.01"
              value={form.selling_price} onChange={set('selling_price')} hint="Per unit, for this lot" />
            <Input label="Manufacturing date" type="date"
              value={form.manufacturing_date} onChange={set('manufacturing_date')} />
            <Input label="Expiry date" required type="date"
              value={form.expiry_date} onChange={set('expiry_date')} error={errors.expiry_date}
              hint="Drives FEFO ordering and the expiry alerts" />
          </div>

          {form.expiry_date && expiryTierOf(form.expiry_date) === EXPIRY_TIER.EXPIRED && (
            <Note tone="danger" className="section" style={{ marginTop: 'var(--sp-4)' }}>
              This expiry date has already passed. An expired lot is blocked from sale and will never be
              allocated, but it will still show in the batch history.
            </Note>
          )}
        </Modal>
      )}
    </>
  );
}
