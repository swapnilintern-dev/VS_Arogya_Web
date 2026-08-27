import { Link } from 'react-router-dom';
import Icon from '../feedback/Icon';
import cn from '../../utils/cn';

/**
 * The KPI tile every dashboard uses. `tone` colours the icon chip only — the
 * number itself stays neutral so a wall of tiles doesn't turn into a rainbow.
 */
export default function StatTile({ label, value, icon, tone, foot, to, onClick }) {
  const body = (
    <>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {icon && <span className="stat__icon"><Icon name={icon} size={15} /></span>}
      </div>
      <span className="stat__value">{value}</span>
      {foot && <span className="stat__foot">{foot}</span>}
    </>
  );

  const className = cn('stat', tone && `stat--${tone}`);
  if (to) return <Link to={to} className={className}>{body}</Link>;
  if (onClick) return <button type="button" className={className} onClick={onClick}>{body}</button>;
  return <div className={className}>{body}</div>;
}
