import { NavLink } from 'react-router-dom';
import Icon from '../feedback/Icon';
import { NAV } from '../../constants/navigation';
import { ROLE_LABELS } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';
import cn from '../../utils/cn';

/**
 * The dashboard sidebar — the desktop translation of the app's bottom
 * NavigationBar. The app's tabs become top-level items; screens the app pushes
 * on top of a tab become sub-routes reached from within the page.
 */
export default function Sidebar({ open, onNavigate }) {
  const { session, role, signOut } = useAuth();
  const sections = NAV[role] || [];

  return (
    <aside className={cn('sidebar', open && 'sidebar--open')}>
      <div className="sidebar__brand">
        <span className="sidebar__mark">VS</span>
        <div>
          <div className="sidebar__name">VS Arogya</div>
          <div className="sidebar__role">{ROLE_LABELS[role]}</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {sections.map((section) => (
          <div className="sidebar__section" key={section.section}>
            <p className="sidebar__label">{section.section}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) => cn('sidebar__link', isActive && 'sidebar__link--on')}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className="sidebar__user">
          <span className="avatar avatar--sm">{initials(session?.name)}</span>
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="sidebar__user-name truncate">{session?.name || 'Signed in'}</p>
            <p className="sidebar__user-meta truncate">{session?.mobile}</p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            style={{ color: 'rgba(255,255,255,.6)' }}
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
