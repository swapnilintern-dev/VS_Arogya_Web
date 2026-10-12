import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';

/**
 * Provider composition. Order matters: Cart reads the session (to know whether
 * to hydrate), and both surface failures through Toast.
 */
export default function App() {
  // Keyed on the path so the entrance animation (styles/motion.css) replays on
  // navigation rather than only on first mount.
  const { pathname } = useLocation();

  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <ScrollRestoration />
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
