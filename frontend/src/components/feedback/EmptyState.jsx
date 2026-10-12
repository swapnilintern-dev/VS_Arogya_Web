import Icon from './Icon';
import cn from '../../utils/cn';

/** The single empty state every list, table and grid uses. */
export default function EmptyState({ icon = 'box', title, text, action, className }) {
  return (
    <div className={cn('state', className)}>
      <div className="state__icon"><Icon name={icon} size={22} /></div>
      {title && <p className="state__title">{title}</p>}
      {text && <p className="state__text">{text}</p>}
      {action}
    </div>
  );
}
