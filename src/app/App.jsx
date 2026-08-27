import { Outlet, ScrollRestoration } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';

/**
 * Provider composition. Order matters: Cart reads the session (to know whether
 * to hydrate), and both surface failures through Toast.
 */
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <ScrollRestoration />
          <Outlet />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
