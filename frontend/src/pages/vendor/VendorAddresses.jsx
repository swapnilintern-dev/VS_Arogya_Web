import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { Input, Textarea } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
import EmptyState from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import ErrorState from '../../components/feedback/ErrorState';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { listAddresses, saveAddress, deleteAddress } from '../../services/vendorService';

const EMPTY = { label: 'Store', fullName: '', phone: '', line1: '', city: '', state: '', pincode: '', isDefault: false };

/** The buyer's address book — GET/POST/PUT/DELETE /addresses. */
export default function VendorAddresses() {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(listAddresses, []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const open = (address) => {
    setEditing(address || 'new');
    setForm(address ? { ...address } : EMPTY);
    setErrors({});
  };

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const save = async () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'A contact name is required';
    if (!/^\d{10}$/.test(form.phone)) e.phone = 'Enter a 10-digit phone number';
    if (!form.line1.trim()) e.line1 = 'The address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter a 6-digit pincode';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      setData(await saveAddress(form));
      setEditing(null);
      toast.success('Address saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address) => {
    const ok = await confirm({
      title: 'Delete this address?',
      message: `"${address.label}" is removed from your address book. Past orders keep the address they were delivered to.`,
      confirmLabel: 'Delete address',
    });
    if (!ok) return;
    try {
      setData(await deleteAddress(address._id));
      toast.success('Address deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const makeDefault = async (address) => {
    setData(await saveAddress({ ...address, isDefault: true }));
    toast.success(`"${address.label}" is now your default address.`);
  };

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Addresses"
        sub="Where your orders are delivered."
        actions={<Button variant="primary" icon="plus" onClick={() => open(null)}>Add address</Button>}
      />

      {loading && <div className="grid grid--2"><CardSkeleton count={2} /></div>}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (data?.length === 0 ? (
        <Card>
          <EmptyState
            icon="pin"
            title="No addresses yet"
            text="Add the address your orders should be delivered to."
            action={<Button variant="primary" icon="plus" onClick={() => open(null)}>Add address</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid--2">
          {data.map((a) => (
            <Card key={a._id}>
              <CardBody className="stack gap-3">
                <div className="between">
                  <span className="row gap-2">
                    <strong>{a.label}</strong>
                    {a.isDefault && <Badge tone="success" dot>Default</Badge>}
                  </span>
                  <span className="row gap-1">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => open(a)} aria-label="Edit address" />
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(a)} aria-label="Delete address" />
                  </span>
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>{a.fullName}</p>
                  <p className="subtle mono" style={{ fontSize: 'var(--fs-sm)' }}>{a.phone}</p>
                  <p className="subtle" style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>
                    {a.line1}, {a.city}, {a.state} — {a.pincode}
                  </p>
                </div>
                {!a.isDefault && (
                  <Button size="sm" variant="secondary" block onClick={() => makeDefault(a)}>Set as default</Button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ))}

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add address' : 'Edit address'}
          onClose={() => setEditing(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
              <Button variant="primary" icon="check" loading={busy} onClick={save}>Save address</Button>
            </>
          )}
        >
          <div className="form-grid">
            <Input label="Label" placeholder="Store / Warehouse / Clinic" value={form.label} onChange={set('label')} />
            <Input label="Contact name" required value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
            <Input label="Phone" required inputMode="numeric" placeholder="10-digit number"
              value={form.phone}
              onChange={(e) => set('phone')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 10) } })}
              error={errors.phone} />
            <Input label="Pincode" required inputMode="numeric" placeholder="6-digit pincode"
              value={form.pincode}
              onChange={(e) => set('pincode')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 6) } })}
              error={errors.pincode} />
            <Field label="Address" required className="span-2" error={errors.line1}>
              <Textarea placeholder="Street, area, landmark" value={form.line1} onChange={set('line1')} />
            </Field>
            <Input label="City" required value={form.city} onChange={set('city')} error={errors.city} />
            <Input label="State" required value={form.state} onChange={set('state')} error={errors.state} />
            <Field className="span-2">
              <label className="checkline">
                <input type="checkbox" checked={form.isDefault} onChange={set('isDefault')} />
                <span>Use this as my default delivery address</span>
              </label>
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
