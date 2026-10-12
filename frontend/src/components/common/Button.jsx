import { Link } from 'react-router-dom';
import Icon from '../feedback/Icon';
import Spinner from '../feedback/Spinner';
import cn from '../../utils/cn';

/**
 * The one button. `to` renders a router Link, `href` an anchor, otherwise a
 * <button>. A loading button stays disabled so a double-click can never fire a
 * mutation twice — which matters for the idempotent order flows.
 */
export default function Button({
  children,
  variant = 'secondary',
  size,
  icon,
  iconRight,
  loading = false,
  disabled = false,
  block = false,
  to,
  href,
  className,
  type = 'button',
  ...rest
}) {
  const classes = cn(
    'btn',
    `btn--${variant}`,
    size && `btn--${size}`,
    block && 'btn--block',
    !children && 'btn--icon',
    className,
  );

  const content = (
    <>
      {loading ? <Spinner inverse={variant === 'primary' || variant === 'danger'} /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </>
  );

  if (to && !disabled) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  if (href && !disabled) {
    return <a href={href} className={classes} target="_blank" rel="noreferrer" {...rest}>{content}</a>;
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}
