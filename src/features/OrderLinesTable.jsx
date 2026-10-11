import { currency, number } from '../utils/format';
import ExpiryBadge from './ExpiryBadge';
import Badge from '../components/common/Badge';

/**
 * An order's line items with their FEFO batch breakdown.
 *
 * `freeQty` is NEVER priced — it is handed over at no charge and printed in the
 * invoice's FREE GOODS column, exactly as server/utils/freeGoods.js treats it.
 * A line that consumed more than one lot shows every allocation.
 */
export default function OrderLinesTable({ items, showBatches = true }) {
  const total = items.reduce((s, it) => s + it.orderPrice * it.quantity, 0);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Medicine</th>
            {showBatches && <th>Batch · expiry</th>}
            <th className="cell-num">Qty</th>
            <th className="cell-num">Free</th>
            <th className="cell-num">Rate</th>
            <th className="cell-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.product?._id || i}>
              <td>
                <p style={{ fontWeight: 600 }}>{it.product?.title || 'Medicine'}</p>
                <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                  {[it.product?.brand, it.product?.packInfo].filter(Boolean).join(' · ')}
                </p>
              </td>
              {showBatches && (
                <td>
                  {it.allocations?.length ? (
                    <div className="stack gap-1">
                      {it.allocations.map((a, j) => (
                        <span key={j} className="row gap-2 nowrap">
                          <span className="mono">{a.batch_number}</span>
                          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>×{a.quantity}</span>
                          <ExpiryBadge date={a.expiry_date} dense />
                        </span>
                      ))}
                    </div>
                  ) : it.batch_no ? (
                    <span className="row gap-2 nowrap">
                      <span className="mono">{it.batch_no}</span>
                      <ExpiryBadge date={it.exp_date} dense />
                    </span>
                  ) : <span className="subtle">—</span>}
                </td>
              )}
              <td className="cell-num">{number(it.quantity)}</td>
              <td className="cell-num">
                {it.freeQty > 0 ? <Badge tone="success">+{it.freeQty}</Badge> : <span className="subtle">—</span>}
              </td>
              <td className="cell-num">{currency(it.orderPrice)}</td>
              <td className="cell-num" style={{ fontWeight: 700 }}>{currency(it.orderPrice * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showBatches ? 5 : 4} className="cell-num" style={{ fontWeight: 700 }}>Order total</td>
            <td className="cell-num" style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{currency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
