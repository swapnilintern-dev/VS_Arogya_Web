import cn from '../../utils/cn';

/**
 * The desktop translation of the app's bottom-tab status filters (marketing
 * pipeline, admin order status, outlet order buckets).
 *
 * options: [{ key, label, count? }]
 */
export default function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn('segmented', className)} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.key ?? 'all'}
          type="button"
          role="tab"
          aria-selected={value === opt.key}
          className={cn('segmented__item', value === opt.key && 'segmented__item--on')}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
          {opt.count !== undefined && <span className="segmented__badge">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
