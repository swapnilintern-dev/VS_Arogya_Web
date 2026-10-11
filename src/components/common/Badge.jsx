import cn from '../../utils/cn';

/** tone: success | warning | danger | info | accent | muted | outline */
export default function Badge({ children, tone = 'muted', dot = false, className }) {
  return (
    <span className={cn('badge', `badge--${tone}`, className)}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
