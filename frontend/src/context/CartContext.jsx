import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as cartService from '../services/cartService';
import { useAuth } from './AuthContext';
import { ROLES } from '../constants/roles';

/**
 * The vendor's cart. The SERVER owns it (it lives on the Vendor document), so
 * every mutation goes through cartService and the refreshed cart replaces local
 * state — the website never guesses what the server did.
 */
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { role } = useAuth();
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);

  // Hydrate on sign-in so a cart filled before the tab was closed reappears.
  useEffect(() => {
    let cancelled = false;
    if (role !== ROLES.VENDOR) { setLines([]); return undefined; }
    cartService.getCart().then((c) => { if (!cancelled) setLines(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [role]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      setLines(await fn());
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(() => {
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    // GST is extracted from the GST-inclusive selling price, the way the app's
    // billing review step computes it.
    const gst = lines.reduce((s, l) => {
      const rate = Number(l.product.gstPercent || 0) / 100;
      const line = l.product.price * l.quantity;
      return s + (rate ? line - line / (1 + rate) : 0);
    }, 0);

    return {
      lines,
      busy,
      itemCount,
      subtotal,
      gst: Math.round(gst * 100) / 100,
      total: Math.round(subtotal * 100) / 100,
      lineFor: (productId) => lines.find((l) => l.product._id === productId) || null,
      add: (product, qty = 1) => run(() => cartService.addToCart(product, qty)),
      increase: (productId) => run(() => cartService.increaseItem(productId)),
      decrease: (productId) => run(() => cartService.decreaseItem(productId)),
      remove: (productId) => run(() => cartService.removeItem(productId)),
      clear: () => run(() => cartService.clearCart()),
      /** Re-read the server's cart (after checkout, which empties it server-side). */
      refresh: () => run(() => cartService.getCart()),
    };
  }, [lines, busy, run]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
