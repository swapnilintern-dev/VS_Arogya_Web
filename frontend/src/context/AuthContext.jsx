import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { UNAUTHORIZED_EVENT } from '../services/http';
import { ROLES, ROLE_LABELS, homeForRole } from '../constants/roles';
import { tierForSession } from '../utils/pricing';

/**
 * Session state for the whole site.
 *
 * The session (role, id, name, JWT) is what the backend's login routes return,
 * persisted in localStorage by authService so a reload restores it. When any
 * authenticated call answers 401 the http client clears the token and raises
 * UNAUTHORIZED_EVENT; this provider drops the session, which sends every
 * ProtectedRoute back to /login.
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

  // Expired / invalid token → sign out locally (the server already refused it).
  useEffect(() => {
    const onUnauthorized = () => {
      authService.clearSession();
      setSession(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback(async (credentials) => {
    const next = await authService.login(credentials);
    setSession(next);
    return next;
  }, []);

  const signInWithOtp = useCallback(async (credentials) => {
    const next = await authService.loginWithOtp(credentials);
    setSession(next);
    return next;
  }, []);

  /**
   * Adopts a session another flow already opened (password reset signs in by
   * OTP before it can set the new password).
   */
  const adoptSession = useCallback((next) => setSession(next), []);

  const signOut = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  const value = useMemo(() => ({
    session,
    booting,
    signIn,
    signInWithOtp,
    adoptSession,
    signOut,
    isAuthenticated: !!session,
    role: session?.role || null,
    roleLabel: session ? ROLE_LABELS[session.role] : null,
    home: session ? homeForRole(session.role) : '/login',
    /** Outlet-scoped calls need the outlet id captured at sign-in. */
    outletId: session?.role === ROLES.OUTLET ? session.id : null,
    /** Which rate card this buyer is on — see utils/pricing.js. */
    pricingTier: tierForSession(session),
  }), [session, booting, signIn, signInWithOtp, adoptSession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
