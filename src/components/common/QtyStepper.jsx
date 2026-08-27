import Icon from '../feedback/Icon';
import cn from '../../utils/cn';

/**
 * "− [12] +" where the number is a real text field — a port of
 * lib/outlet/outlet_qty_field.dart, including the rules it enforces
 * structurally rather than by after-the-fact validation:
 *   • digits only,
 *   • never below `min` (− at min calls onRemove when one is given),
 *   • never above `max` — the pinned batch's available units.
 * `max = 0` means "no server-reported ceiling yet".
 */
export default function QtyStepper({ value, onChange, min = 1, max = 0, onRemove, size, disabled }) {
  const capped = max > 0;
  const atMax = capped && value >= max;

  const commit = (next) => {
    let n = Number(next);
    if (Number.isNaN(n)) return;
    if (capped) n = Math.min(n, max);
    if (n < min) {
      if (onRemove) { onRemove(); return; }
      n = min;
    }
    onChange(n);
  };

  return (
    <div className={cn('qty', size === 'sm' && 'qty--sm')}>
      <button
        type="button"
        className="qty__btn"
        onClick={() => (value <= min && onRemove ? onRemove() : commit(value - 1))}
        disabled={disabled || (value <= min && !onRemove)}
        aria-label={value <= min && onRemove ? 'Remove line' : 'Decrease quantity'}
      >
        <Icon name={value <= min && onRemove ? 'trash' : 'minus'} size={size === 'sm' ? 11 : 12} />
      </button>
      <input
        className="qty__input"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          if (digits === '') return; // an empty entry must not delete the line mid-edit
          commit(digits);
        }}
        aria-label="Quantity"
      />
      <button
        type="button"
        className="qty__btn"
        onClick={() => commit(value + 1)}
        disabled={disabled || atMax}
        title={atMax ? `Only ${max} available in this lot` : undefined}
        aria-label="Increase quantity"
      >
        <Icon name="plus" size={size === 'sm' ? 11 : 12} />
      </button>
    </div>
  );
}
