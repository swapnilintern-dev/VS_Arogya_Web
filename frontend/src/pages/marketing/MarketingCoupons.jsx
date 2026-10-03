import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { Card } from '../../components/common/Card';
import { Input, Textarea } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { listCoupons, createCoupon, toggleCoupon, deleteCoupon } from '../../services/couponService';
import { currency, number } from '../../utils/format';
import { formatDate, toInputDate } from '../../utils/dates';

/**
 * Coupons. An EXPIRED coupon is greyed out and cannot be re-enabled — the
 * server only ever returns active, non-expired coupons to vendors, so
 * re-activating a lapsed code would be a no-op that looks like it worked.
 */
const EMPTY = { code: '', description: '', percentOff: 10, maxDiscount: '', expiresAt: '' };

export default function MarketingCoupons() {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(listCoupons, []);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [busyCode, setBusyCode] = useState(null);

  const table = useTableControls(data, {
    searchKeys: ['code', 'description'],
    initialSort: { key: 'redemptions', dir: 'desc' },
  });

  const active = (data || []).filter((c) => c.active && !c.expired);
  const redemptions = (data || []).reduce((s, c) => s + c.redemptions, 0);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const save = async () => {
    const e = {};
    if (!/^[A-Z0-9]{4,16}$/.test(form.code)) e.code = 'Use 4–16 uppercase letters or digits';
    else if ((data || []).some((c) => c.code === form.code)) e.code = 'That code already exists';
    if (!form.description.trim()) e.description = 'Describe what the vendor gets';
    if (!form.percentOff || form.percentOff <= 0 || form.percentOff > 100) e.percentOff = 'Enter 1–100';
    if (!form.expiresAt) e.expiresAt = 'Set an expiry date';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const created = await createCoupon({
        ...form,
        percentOff: Number(form.percentOff),
        maxDiscount: Number(form.maxDiscount) || undefined,
      });
      setData((rows) => [created, ...rows]);
      setCreating(false);
      setForm(EMPTY);
      toast.success(`${created.code} is live.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const flip = async (coupon) => {
    setBusyCode(coupon.code);
    try {
      await toggleCoupon(coupon.code);
      setData((rows) => rows.map((c) => (c.code === coupon.code ? { ...c, active: !c.active } : c)));
      toast.success(`${coupon.code} ${coupon.active ? 'disabled' : 'enabled'}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyCode(null);
    }
  };

  const remove = async (coupon) => {
    const ok = await confirm({
      title: `Delete ${coupon.code}?`,
      message: `This code has been redeemed ${coupon.redemptions} time(s). Deleting it stops any further use; past orders keep the discount they already received.`,
      confirmLabel: 'Delete coupon',
    });
    if (!ok) return;
    try {
      await deleteCoupon(coupon.code);
      setData((rows) => rows.filter((c) => c.code !== coupon.code));
      toast.success('Coupon deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (c) => (
        <span className="mono" style={{ fontWeight: 800, fontSize: 'var(--fs-md)', opacity: c.expired ? 0.5 : 1 }}>
          {c.code}
        </span>
      ),
    },
    { key: 'description', header: 'Offer', render: (c) => <span className={c.expired ? 'subtle' : undefined}>{c.description}</span> },
    {
      key: 'percentOff',
      header: 'Discount',
      align: 'right',
      sortable: true,
      render: (c) => (
        <span>
          <strong style={{ display: 'block' }}>{c.percentOff}%</strong>
          {c.maxDiscount ? <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>max {currency(c.maxDiscount)}</span> : null}
        </span>
      ),
    },
    { key: 'redemptions', header: 'Redemptions', align: 'right', sortable: true, render: (c) => number(c.redemptions) },
    { key: 'expiresAt', header: 'Expires', sortable: true, render: (c) => <span className="nowrap">{formatDate(c.expiresAt)}</span> },
    {
      key: 'active',
      header: 'Status',
      sortable: true,
      render: (c) => (c.expired
        ? <Badge tone="muted">Expired</Badge>
        : <Badge tone={c.active ? 'success' : 'muted'} dot>{c.active ? 'Active' : 'Disabled'}</Badge>),
    },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (c) => (
        <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" disabled={c.expired} loading={busyCode === c.code} onClick={() => flip(c)}>
            {c.active ? 'Disable' : 'Enable'}
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(c)} aria-label="Delete coupon" />
        </span>
      ),
    },
  ];

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Coupons"
        sub="Discount codes vendors can apply at checkout."
        actions={(
          <>
            <Button icon="image" to="/marketing/banners">Promo banners</Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create coupon</Button>
          </>
        )}
      />

      <div className="grid grid--kpi section">
        <StatTile label="Total coupons" value={number(data?.length ?? 0)} icon="tag" />
        <StatTile label="Live now" value={number(active.length)} icon="check" tone="accent" foot="Active and not expired" />
        <StatTile label="Total redemptions" value={number(redemptions)} icon="percent" foot="Across every code" />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by code or offer…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          empty={{
            icon: 'tag',
            title: 'No coupons',
            text: 'Create a discount code for vendors to apply at checkout.',
            action: <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create coupon</Button>,
          }}
        />
      </Card>

      {creating && (
        <Modal
          title="Create coupon"
          sub="Vendors enter the code at checkout"
          onClose={() => setCreating(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
              <Button variant="primary" icon="check" loading={busy} onClick={save}>Create coupon</Button>
            </>
          )}
        >
          <div className="form-grid">
            <Input label="Coupon code" required placeholder="e.g. BULK20"
              value={form.code}
              onChange={(e) => set('code')({ target: { value: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) } })}
              error={errors.code} hint="Uppercase letters and digits only" />
            <Input label="Expires on" required type="date" min={toInputDate(new Date())}
              value={form.expiresAt} onChange={set('expiresAt')} error={errors.expiresAt} />
            <Field label="Offer description" required className="span-2" error={errors.description}>
              <Textarea placeholder="e.g. 20% off on orders above ₹10,000"
                value={form.description} onChange={set('description')} />
            </Field>
            <Input label="Discount %" required type="number" min="1" max="100"
              value={form.percentOff} onChange={set('percentOff')} error={errors.percentOff} />
            <Input label="Maximum discount" type="number" min="0"
              value={form.maxDiscount} onChange={set('maxDiscount')} hint="Optional cap in rupees" />
          </div>
        </Modal>
      )}
    </>
  );
}
