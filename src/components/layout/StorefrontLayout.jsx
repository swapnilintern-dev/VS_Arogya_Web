import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from '../feedback/Icon';
import Button from '../common/Button';
import { SearchInput } from '../forms/Input';
import { VENDOR_NAV } from '../../constants/navigation';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { USE_MOCK } from '../../services/http';
import { initials } from '../../utils/format';
import cn from '../../utils/cn';

/**
 * The Vendor experience is a storefront, not a console: top navigation, a
 * prominent catalogue search and a cart pill. Deliberately different from the
 * internal dashboards while sharing the same palette and components.
 */
export default function StorefrontLayout() {
  const { session, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const search = (e) => {
    e.preventDefault();
    navigate(`/shop/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  };

  return (
    <div className="store">
      {USE_MOCK && (
        <div className="devbar">
          <Icon name="info" size={13} />
          Demo data — services resolve from <code>src/mock</code>; no backend calls are made.
        </div>
      )}

      <header className="store__bar">
        <div className="store__bar-inner">
          <Link to="/shop" className="store__brand">
            <span className="sidebar__mark">VS</span>
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--fs-md)' }}>VS Arogya</span>
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand-700)' }}>
                Vendor portal
              </span>
            </span>
          </Link>

          <nav className="store__nav">
            {VENDOR_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn('store__link', isActive && 'store__link--on')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form className="store__search" onSubmit={search}>
            <SearchInput value={query} onChange={setQuery} placeholder="Search medicines, brands, categories…" />
          </form>

          <div className="store__actions">
            <Button variant="ghost" icon="bell" to="/shop/notifications" aria-label="Notifications" />
            <Link to="/shop/cart" className="cart-pill">
              <Icon name="cart" size={15} />
              Cart
              {itemCount > 0 && <span className="cart-pill__count">{itemCount}</span>}
            </Link>
            <Link to="/shop/profile" className="avatar" title={session?.name}>
              {initials(session?.name)}
            </Link>
            <Button variant="ghost" icon="logout" onClick={signOut} aria-label="Sign out" />
          </div>
        </div>
      </header>

      <main className="store__body"><Outlet /></main>

      <footer className="store__foot">
        <div className="store__foot-inner">
          <span>VS Arogya — B2B medicine distribution. Licensed wholesale supply to pharmacies, clinics and hospitals.</span>
          <Link to="/shop/about" style={{ fontWeight: 600, color: 'var(--brand-700)' }}>About us</Link>
        </div>
      </footer>
    </div>
  );
}
