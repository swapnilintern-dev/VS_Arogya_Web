import Icon from '../feedback/Icon';
import EmptyState from '../feedback/EmptyState';
import ErrorState from '../feedback/ErrorState';
import { TableSkeleton } from '../feedback/Skeleton';
import cn from '../../utils/cn';

/**
 * The site's one table.
 *
 * columns: [{
 *   key,            // row key or accessor function, also the sort key
 *   header,
 *   render?,        // (row) => node
 *   align?,         // 'right' for numbers
 *   sortable?,
 *   width?,
 * }]
 *
 * Loading, empty and error states are handled here rather than by each page,
 * which is why they look identical across all six roles.
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  onRowClick,
  rowKey = (r) => r._id ?? r.id,
  sort,
  onSort,
  empty = {},
  skeletonRows = 6,
}) {
  const body = () => {
    if (loading) return <TableSkeleton rows={skeletonRows} cols={columns.length} />;
    if (error) {
      return (
        <tbody>
          <tr>
            <td colSpan={columns.length} style={{ padding: 0 }}>
              <ErrorState error={error} onRetry={onRetry} />
            </td>
          </tr>
        </tbody>
      );
    }
    if (!rows?.length) {
      return (
        <tbody>
          <tr>
            <td colSpan={columns.length} style={{ padding: 0 }}>
              <EmptyState
                icon={empty.icon || 'box'}
                title={empty.title || 'Nothing to show'}
                text={empty.text}
                action={empty.action}
              />
            </td>
          </tr>
        </tbody>
      );
    }
    return (
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            className={cn(onRowClick && 'is-clickable')}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <td
                key={String(col.header)}
                className={cn(col.align === 'right' && 'cell-num', col.align === 'actions' && 'cell-actions')}
                onClick={col.align === 'actions' ? (e) => e.stopPropagation() : undefined}
              >
                {col.render
                  ? col.render(row)
                  : typeof col.key === 'function'
                    ? col.key(row)
                    : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={String(col.header)}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    col.sortable && onSort && 'sortable',
                    col.align === 'right' && 'cell-num',
                    col.align === 'actions' && 'cell-actions',
                  )}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  {col.header}
                  {col.sortable && onSort && active && (
                    <Icon
                      name={sort.dir === 'asc' ? 'arrowUp' : 'chevronDown'}
                      size={11}
                      className="sort-arrow"
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        {body()}
      </table>
    </div>
  );
}
