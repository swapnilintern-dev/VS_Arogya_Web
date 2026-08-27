import cn from '../../utils/cn';

export function Skeleton({ w = '100%', h = 12, r, className, style }) {
  return (
    <span
      className={cn('skeleton', className)}
      style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/** Placeholder rows matching the DataTable's geometry. */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}><Skeleton w={c === 0 ? '70%' : '45%'} h={11} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card card--pad stack gap-3">
          <Skeleton w="55%" h={11} />
          <Skeleton w="35%" h={22} />
          <Skeleton w="70%" h={9} />
        </div>
      ))}
    </>
  );
}

export default Skeleton;
