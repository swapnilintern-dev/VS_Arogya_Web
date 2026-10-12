import { Link, useLocation } from 'react-router-dom';
import Icon from '../feedback/Icon';
import { NAV } from '../../constants/navigation';
import { useAuth } from '../../context/AuthContext';

/** Derives a breadcrumb trail from the sidebar definition + the current path. */
function useCrumbs() {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const items = (NAV[role] || []).flatMap((s) => s.items);

  const match = items
    .filter((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];

  if (!match) return [];
  if (pathname === match.to) return [{ label: match.label }];
  return [{ label: match.label, to: match.to }, { label: 'Details' }];
}

export default function Topbar({ onBurger }) {
  const crumbs = useCrumbs();

  return (
    <header className="topbar">
      <button type="button" className="btn btn--ghost btn--icon topbar__burger" onClick={onBurger} aria-label="Open menu">
        <Icon name="menu" size={18} />
      </button>

      <nav className="topbar__crumbs">
        {crumbs.map((c, i) => (
          <span key={`${i}-${c.label}`} className="row gap-1">
            {i > 0 && <Icon name="chevronRight" size={11} />}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.label}</span>}
          </span>
        ))}
      </nav>

      <div className="topbar__spacer" />

    </header>
  );
}
