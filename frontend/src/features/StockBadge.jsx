import Badge from '../components/common/Badge';
import { stockStatusOf, STOCK_META } from '../utils/stock';
import { number } from '../utils/format';

/**
 * Stock level with its grade. `stock` is the backend's mirror of
 * SUM(batch.available_quantity) — the website never computes inventory.
 */
export default function StockBadge({ stock, lowThreshold, showCount = true, unit = 'units' }) {
  const status = stockStatusOf(stock, lowThreshold);
  const meta = STOCK_META[status];
  return (
    <span className="row gap-2 nowrap">
      {showCount && <span className="num" style={{ fontWeight: 700 }}>{number(stock)}</span>}
      {showCount && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{unit}</span>}
      <Badge tone={meta.tone} dot>{meta.label}</Badge>
    </span>
  );
}
