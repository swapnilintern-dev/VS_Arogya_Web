import { useState } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/feedback/EmptyState';
import ErrorState from '../components/feedback/ErrorState';
import Spinner from '../components/feedback/Spinner';
import ExpiryBadge from './ExpiryBadge';
import useAsync from '../hooks/useAsync';
import { currency, number } from '../utils/format';
import { formatDate } from '../utils/dates';
import cn from '../utils/cn';

/**
 * Pick ONE lot for a line — the desktop translation of the app's batch picker
 * bottom sheet (lib/outlet/outlet_batch_picker.dart, lib/widgets/batch_selector.dart).
 *
 * Everything shown is read live from the backend, which already returns only
 * SELLABLE lots in FEFO order — nearest expiry first. This component therefore
 * never sorts, filters or invents inventory: the server's order IS the policy,
 * and the nearest-expiry lot sits on top and is pre-selected.
 */
export default function BatchPicker({
  productName,
  fetchBatches,
  selectedBatchId,
  onSelect,
  onClose,
}) {
  const { data: batches, loading, error, reload } = useAsync(fetchBatches, []);
  const [choice, setChoice] = useState(selectedBatchId || null);

  const pick = batches?.find((b) => b._id === choice) || null;

  return (
    <Modal
      title="Select batch"
      sub={`${productName} · sellable lots only, nearest expiry first (FEFO)`}
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!pick} onClick={() => { onSelect(pick); onClose(); }}>
            Use this batch
          </Button>
        </>
      )}
    >
      {loading && <div className="state"><Spinner size="lg" /></div>}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && !batches?.length && (
        <EmptyState
          icon="layers"
          title="No sellable lots"
          text="Every lot of this medicine is either empty or past its expiry date. Restock before it can be issued."
        />
      )}

      {!loading && !error && batches?.length > 0 && (
        <div className="stack gap-2">
          {batches.map((b, i) => (
            <button
              key={b._id}
              type="button"
              onClick={() => setChoice(b._id)}
              className={cn('row', 'gap-4')}
              style={{
                textAlign: 'left',
                padding: 'var(--sp-3) var(--sp-4)',
                border: `1px solid ${choice === b._id ? 'var(--brand-500)' : 'var(--border)'}`,
                background: choice === b._id ? 'var(--brand-050)' : 'var(--surface)',
                borderRadius: 'var(--r-md)',
                boxShadow: choice === b._id ? '0 0 0 3px rgba(76,175,130,.14)' : 'none',
              }}
            >
              <span
                style={{
                  width: 16, height: 16, borderRadius: '50%', flex: 'none',
                  border: `5px solid ${choice === b._id ? 'var(--brand-700)' : 'var(--border-strong)'}`,
                  background: '#fff',
                }}
              />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="row gap-2 wrap">
                  <span className="mono" style={{ fontWeight: 700 }}>{b.batch_number}</span>
                  {i === 0 && <Badge tone="info">FEFO front</Badge>}
                  <ExpiryBadge date={b.expiry_date} />
                </span>
                <span className="subtle" style={{ fontSize: 'var(--fs-xs)', display: 'block', marginTop: 3 }}>
                  {[
                    b.supplier,
                    b.manufacturing_date ? `Mfg ${formatDate(b.manufacturing_date)}` : null,
                    b.selling_price ? `Sell ${currency(b.selling_price)}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-right nowrap">
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{number(b.available_quantity)}</span>
                <span className="subtle" style={{ fontSize: 'var(--fs-xs)', display: 'block' }}>available</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
