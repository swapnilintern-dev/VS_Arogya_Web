import Icon from '../feedback/Icon';
import cn from '../../utils/cn';

/** tone: info | warning | danger | success */
export default function Note({ tone = 'info', icon, children, className, ...rest }) {
  const fallback = { info: 'info', warning: 'alert', danger: 'alert', success: 'check' }[tone];
  return (
    <div className={cn('note', `note--${tone}`, className)} {...rest}>
      <Icon name={icon || fallback} size={15} />
      <div>{children}</div>
    </div>
  );
}
