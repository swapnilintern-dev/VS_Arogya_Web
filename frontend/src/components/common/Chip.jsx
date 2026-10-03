import cn from '../../utils/cn';

export default function Chip({ children, active = false, count, onClick, className }) {
  return (
    <button type="button" className={cn('chip', active && 'chip--on', className)} onClick={onClick}>
      {children}
      {count !== undefined && <span className="chip__count">{count}</span>}
    </button>
  );
}
