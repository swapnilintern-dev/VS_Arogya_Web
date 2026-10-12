import Icon from '../feedback/Icon';
import cn from '../../utils/cn';

/** Windowed page buttons: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i += 1) out.push(i);
  if (to < pageCount - 1) out.push('…');
  out.push(pageCount);
  return out;
}

export default function Pagination({ page, pageCount, total, pageSize, onPage, onPageSize, label = 'rows' }) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span>
        {total === 0 ? `No ${label}` : `${first}–${last} of ${total} ${label}`}
      </span>

      <div className="row gap-3">
        {onPageSize && (
          <label className="row gap-2">
            <span className="nowrap">Per page</span>
            <select
              className="select"
              style={{ minHeight: 28, padding: '2px 26px 2px 8px', fontSize: 'var(--fs-sm)' }}
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
            >
              {[10, 12, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}

        <div className="pagination__pages">
          <button
            type="button"
            className="pagination__page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            <Icon name="chevronLeft" size={13} />
          </button>
          {pageWindow(page, pageCount).map((p, i) => (
            p === '…'
              ? <span key={`gap${i}`} className="pagination__page" aria-hidden>…</span>
              : (
                <button
                  key={p}
                  type="button"
                  className={cn('pagination__page', p === page && 'pagination__page--on')}
                  onClick={() => onPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              )
          ))}
          <button
            type="button"
            className="pagination__page"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <Icon name="chevronRight" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
