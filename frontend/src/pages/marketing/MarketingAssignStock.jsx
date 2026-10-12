import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import QtyStepper from '../../components/common/QtyStepper';
import { Input, SearchInput } from '../../components/forms/Input';
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
import { listOutlets, assignStockToOutlet } from '../../services/outletService';
import { listProducts, listAvailableBatches } from '../../services/productService';
import { number, initials } from '../../utils/format';

/**
 * Marketing → outlet stock assignment.
 *
 * This is an UPDATE-STOCK flow for our own outlets, not a customer order — so
 * there is NO price and no money anywhere on this screen, matching
 * lib/marketing/select_outlet_screen.dart.
 *
 * The server ADDS to whatever the outlet already holds and deducts the same
 * units from the catalogue, so a quantity here means "how much more to send",
 * never "set the outlet's stock to this".
 *
 * BATCH SELECTION IS MANDATORY. Stock is physical: the head must state exactly
 * which lot leaves the warehouse. The chosen lots travel with the assignment,
 * and the server records the SAME batch identity on the outlet's stock, so the
 * outlet knows precisely which lots — and expiries — it received.
 */
export default function MarketingAssignStock() {
  const toast = useToast();
  const [params] = useSearchParams();

  const [pincode, setPincode] = useState('');
  const [outlet, setOutlet] = useState(null);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState([]);
  const [picking, setPicking] = useState(null);
  const [busy, setBusy] = useState(false);

  const outlets = useAsync(listOutlets, []);
  const products = useAsync(listProducts, []);
  const q = useDebounce(query, 200);

  // Deep-linked from the outlet list.
  useEffect(() => {
    const preselect = params.get('outlet');
    if (preselect && outlets.data && !outlet) {
      const found = outlets.data.find((o) => o._id === preselect);
      if (found) { setOutlet(found); setPincode(found.pincode); }
    }
  }, [params, outlets.data, outlet]);

  const outletResults = useMemo(() => {
    const rows = (outlets.data || []).filter((o) => o.status === 'Active');
    if (!pincode.trim()) return rows;
    return rows.filter((o) => o.pincode.startsWith(pincode.trim()));
  }, [outlets.data, pincode]);

  const productResults = useMemo(() => {
    const rows = (products.data || []).filter((p) => p.stock > 0);
    const term = q.trim().toLowerCase();
    if (!term) return rows.slice(0, 30);
    return rows.filter((p) => [p.title, p.brand, p.code].some((f) => String(f || '').toLowerCase().includes(term))).slice(0, 30);
  }, [products.data, q]);

  const addLine = async (product) => {
    if (lines.some((l) => l.product._id === product._id)) {
      toast.info(`${product.title} is already in this assignment.`);
      return;
    }
    const batches = await listAvailableBatches(product._id);
    if (!batches.length) {
      toast.error(`${product.title} has no sellable lot to send.`);
      return;
    }
    // Guarded inside the updater — the await above means two rapid clicks
    // would otherwise both get past an outer duplicate check.
    setLines((rows) => (rows.some((l) => l.product._id === product._id)
      ? rows
      : [...rows, { product, quantity: 1, batch: batches[0] }]));
  };

  const send = async () => {
    setBusy(true);
    try {
      await assignStockToOutlet({ outletId: outlet._id, lines });
      toast.success(`${lines.length} medicine(s) sent to ${outlet.outletName}.`);
      setLines([]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const overCapacity = lines.some((l) => l.batch && l.quantity > l.batch.available_quantity);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Outlets', to: '/marketing/outlets' }, { label: 'Assign stock' }]}
        title="Assign stock to an outlet"
        sub="Move catalogue stock into a physical counter. Quantities are additive — how much MORE to send."
      />

      <Note tone="info" className="section">
        No prices here: this is an internal stock movement, not a sale. The units you send are deducted from
        the catalogue and recorded against the outlet with the <strong>same batch identity</strong>, so the
        outlet can trace every lot it holds back to the one that left the warehouse.
      </Note>

      <div className="grid" style={{ gridTemplateColumns: '300px minmax(0, 1fr) 380px', gap: 'var(--sp-4)', alignItems: 'start' }}>
        <Card>
          <CardHead title="1 · Outlet" sub="Filter by pincode" />
          <div className="table-toolbar">
            <Input
              inputMode="numeric"
              placeholder="Enter a pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto', padding: 'var(--sp-2)' }}>
            {outlets.loading && <div className="state"><Spinner /></div>}
            {!outlets.loading && outletResults.length === 0 && (
              <EmptyState icon="store" title="No outlet in that pincode" text="Clear the pincode to see every active outlet." />
            )}
            {outletResults.map((o) => (
              <button
                key={o._id}
                type="button"
                onClick={() => setOutlet(o)}
                className="row gap-3"
                style={{
                  width: '100%',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderRadius: 'var(--r-md)',
                  textAlign: 'left',
                  background: outlet?._id === o._id ? 'var(--brand-100)' : 'transparent',
                }}
              >
                <span className="avatar avatar--sm">{initials(o.outletName)}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{o.outletName}</span>
                  <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{o.city} · {o.pincode}</span>
                </span>
                {outlet?._id === o._id && <Icon name="check" size={14} strokeWidth={2.6} />}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="2 · Medicines" sub="Only medicines with stock can be sent" />
          <div className="table-toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search the catalogue…" />
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {products.loading && <div className="state"><Spinner /></div>}
            {!products.loading && productResults.length === 0 && (
              <EmptyState icon="pill" title="Nothing to send" text="No medicine matches, or everything is out of stock." />
            )}
            <table className="table">
              <tbody>
                {productResults.map((p) => {
                  const added = lines.some((l) => l.product._id === p._id);
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
                      <td><StockBadge stock={p.stock} lowThreshold={p.lowThreshold} unit="in warehouse" /></td>
                      <td className="cell-actions">
                        <Button size="sm" variant={added ? 'ghost' : 'secondary'} icon={added ? 'check' : 'plus'}
                          disabled={added || !outlet} onClick={() => addLine(p)}>
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
            <CardHead title="3 · Send" sub={outlet ? outlet.outletName : 'Pick an outlet first'} />
            <CardBody className="stack gap-4">
              {!outlet && <Note tone="info">Select the outlet that will receive this stock.</Note>}

              {lines.length === 0 ? (
                <EmptyState icon="send" title="Nothing added yet" text="Add medicines and set how many units to send." />
              ) : (
                <div className="stack gap-3">
                  {lines.map((l) => {
                    const over = l.quantity > (l.batch?.available_quantity ?? 0);
                    return (
                      <div
                        key={l.product._id}
                        className="stack gap-2"
                        style={{
                          padding: 'var(--sp-3)',
                          border: `1px solid ${over ? 'var(--danger)' : 'var(--border)'}`,
                          borderRadius: 'var(--r-md)',
                        }}
                      >
                        <div className="row gap-3">
                          <ProductThumb product={l.product} />
                          <span className="grow truncate" style={{ fontWeight: 600 }}>{l.product.title}</span>
                          <Button size="sm" variant="ghost" icon="trash"
                            onClick={() => setLines((rows) => rows.filter((r) => r.product._id !== l.product._id))}
                            aria-label="Remove" />
                        </div>

                        <button
                          type="button"
                          className="between"
                          onClick={() => setPicking(l)}
                          style={{ padding: '6px var(--sp-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', width: '100%' }}
                        >
                          <span className="row gap-2" style={{ minWidth: 0 }}>
                            <Icon name="layers" size={13} />
                            <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{l.batch?.batch_number}</span>
                            <ExpiryBadge date={l.batch?.expiry_date} dense />
                          </span>
                          <span className="row gap-1 subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                            Change <Icon name="chevronRight" size={11} />
                          </span>
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
                          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                            lot holds {number(l.batch?.available_quantity ?? 0)}
                          </span>
                        </div>

                        {over && (
                          <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--danger-strong)' }}>
                            More than this lot holds. Reduce the quantity or pick another lot.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {lines.length > 0 && (
                <KeyValue rows={[
                  { label: 'Medicines', value: number(lines.length) },
                  { label: 'Units leaving the warehouse', value: number(lines.reduce((s, l) => s + l.quantity, 0)) },
                  { label: 'Receiving outlet', value: outlet?.outletName || '—' },
                ]} />
              )}

              <Button
                variant="primary" size="lg" block icon="send"
                loading={busy}
                disabled={!outlet || lines.length === 0 || overCapacity}
                onClick={send}
              >
                Send stock to outlet
              </Button>

              <p className="subtle text-center" style={{ fontSize: 'var(--fs-xs)' }}>
                One call per medicine. Quantities are added to what the outlet already holds.
              </p>
            </CardBody>
          </Card>

          {outlet && (
            <Card>
              <CardHead title="Receiving outlet" />
              <CardBody>
                <KeyValue rows={[
                  { label: 'Outlet', value: outlet.outletName },
                  { label: 'Owner', value: outlet.ownerName },
                  { label: 'Address', value: outlet.address },
                  { label: 'City', value: `${outlet.city} · ${outlet.pincode}` },
                  { label: 'Status', value: <Badge tone="success" dot>{outlet.status}</Badge> },
                ]} />
              </CardBody>
            </Card>
          )}
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
