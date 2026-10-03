import { Navigate, useLocation } from 'react-router-dom';
import Spinner from '../components/feedback/Spinner';
import { useAuth } from '../context/AuthContext';
import { homeForRole } from '../constants/roles';

/**
 * Role guard.
 *
 * Two failure modes, deliberately distinct:
 *   • not signed in       → /login, remembering where the user was headed;
 *   • signed in, wrong role → that role's OWN home, never a 403 page. A vendor
 *     who lands on /admin is not a security event on the client; the server is
 *     the real authority. What matters is that Admin UI is never rendered for a
 *     Vendor session.
 */
export default function ProtectedRoute({ allow, children }) {
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
  if (allow && !allowed.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return children;
}
