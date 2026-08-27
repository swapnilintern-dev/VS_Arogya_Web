import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { ROLES, ROLE_LABELS, homeForRole } from '../constants/roles';

/**
 * Session state for the whole site.
 *
 * MOCK AUTHENTICATION: while VITE_USE_MOCK is true, authService resolves logins
 * against src/mock/users.js instead of the backend. This provider does not
 * know or care which — it calls the same functions either way, which is what
 * makes real authentication a flag flip rather than a refactor.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore a saved session at start, exactly as SplashScreen does in the app.
  useEffect(() => {
    setSession(authService.readSession());
    setBooting(false);
  }, []);

  const signIn = useCallback(async (credentials) => {
    const next = await authService.login(credentials);
    setSession(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  const value = useMemo(() => ({
    session,
    booting,
    signIn,
    signOut,
    isAuthenticated: !!session,
    role: session?.role || null,
    roleLabel: session ? ROLE_LABELS[session.role] : null,
    home: session ? homeForRole(session.role) : '/login',
    /** Outlet-scoped calls need the outlet id captured at sign-in. */
    outletId: session?.role === ROLES.OUTLET ? session.id : null,
  }), [session, booting, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
