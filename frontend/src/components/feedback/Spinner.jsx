import cn from '../../utils/cn';

export default function Spinner({ size = 'md', inverse = false, className }) {
  return (
    <span
      className={cn('spinner', size === 'lg' && 'spinner--lg', inverse && 'spinner--inverse', className)}
      role="status"
      aria-label="Loading"
    />
  );
}
