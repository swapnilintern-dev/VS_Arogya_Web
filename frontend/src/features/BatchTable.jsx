import DataTable from '../components/tables/DataTable';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import ExpiryBadge from './ExpiryBadge';
import { currency, number } from '../utils/format';
import { formatDate } from '../utils/dates';

/**
 * Every lot of a product. Columns mirror server/model/productBatchModel.js:
 * purchase quantity is the immutable reference, available quantity is what FEFO
 * decrements, and the two prices are per-lot rather than per-product.
 */
export default function BatchTable({ batches, loading, error, onRetry, onEdit, onDelete, readOnly = false }) {
  const columns = [
    {
      key: 'batch_number',
      header: 'Batch no.',
      sortable: true,
      render: (b) => (
        <span className="row gap-2">
          <span className="mono" style={{ fontWeight: 700 }}>{b.batch_number}</span>
          {b.available_quantity === 0 && <Badge tone="muted">Emptied</Badge>}
        </span>
      ),
    },
    { key: 'supplier', header: 'Supplier', sortable: true, render: (b) => b.supplier || <span className="subtle">—</span> },
    { key: 'manufacturing_date', header: 'Mfg date', sortable: true, render: (b) => formatDate(b.manufacturing_date) },
    { key: 'expiry_date', header: 'Expiry', sortable: true, render: (b) => <ExpiryBadge date={b.expiry_date} showDate /> },
    { key: 'purchase_quantity', header: 'Purchased', align: 'right', sortable: true, render: (b) => number(b.purchase_quantity) },
    {
      key: 'available_quantity',
      header: 'Available',
      align: 'right',
      sortable: true,
      render: (b) => <strong className="num">{number(b.available_quantity)}</strong>,
    },
    { key: 'purchase_price', header: 'Cost', align: 'right', sortable: true, render: (b) => currency(b.purchase_price) },
    { key: 'selling_price', header: 'Sell', align: 'right', sortable: true, render: (b) => currency(b.selling_price) },
  ];

  if (!readOnly) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'actions',
      render: (b) => (
        <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(b)} aria-label="Edit batch" />
          <Button size="sm" variant="ghost" icon="trash" onClick={() => onDelete(b)} aria-label="Delete batch" />
        </span>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={batches}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={{
        icon: 'layers',
        title: 'No batches yet',
        text: 'Every purchase of this medicine is its own lot, with its own quantity, expiry and pricing. Add the first one to start tracking stock.',
      }}
    />
  );
}
