import { Navigate, useLocation } from 'react-router-dom';
import Spinner from '../components/feedback/Spinner';
import { useAuth } from '../context/AuthContext';
import { homeForRole, ROLES } from '../constants/roles';

/**
 * Role guard.
 *
 * Two failure modes, deliberately distinct:
 *   • not signed in       → /login, remembering where the user was headed;
 *   • signed in, wrong role → that role's OWN home, never a 403 page. A vendor
 *     who lands on /admin is not a security event on the client; the server is
 *     the real authority. What matters is that Admin UI is never rendered for a
 *     Vendor session.
 *
 * A GUEST (email OTP, no approved vendor account) is allowed through the
 * vendor segment only, and `guestAllows` then narrows that to the browsing
 * routes. Everything else there — cart, orders, profile — would 403 at the
 * server anyway, so sending them back to the catalogue beats rendering a page
 * that can only fail.
 */
/** "/shop" matches itself; "/shop/products/*" matches any path beneath it. */
const matches = (pathname, pattern) => (pattern.endsWith('/*')
  ? pathname === pattern.slice(0, -2) || pathname.startsWith(pattern.slice(0, -1))
  : pathname === pattern);

export default function ProtectedRoute({ allow, guestAllows, children }) {
  const { session, booting, role } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="state" style={{ minHeight: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = Array.isArray(allow) ? allow : [allow];

  if (role === ROLES.GUEST) {
    // The guest may only reach the vendor storefront, and only its browsing
    // routes within that.
    if (!allowed.includes(ROLES.VENDOR)) return <Navigate to="/shop" replace />;
    if (guestAllows && !guestAllows.some((p) => matches(location.pathname, p))) {
      return <Navigate to="/shop" replace />;
    }
    return children;
  }

  if (allow && !allowed.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return children;
}
