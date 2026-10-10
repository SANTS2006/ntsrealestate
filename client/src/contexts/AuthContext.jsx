import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { authApi } from '../api/auth.js';
import { tenantAuthApi } from '../api/tenantAuth.js';
import { setCurrentPermissions } from '../config/capabilities.js';

const AuthContext = createContext(null);

// Remembered per-browser only, never sent anywhere — the dashboard routes
// themselves carry no org slug in the URL (the session already knows the
// organization), but ProtectedRoute needs *some* slug to redirect an
// expired/logged-out session back to the right tenant's own login page
// instead of a bare, unscoped (and no longer valid) "/login".
const LAST_ORG_SLUG_KEY = 'nts.lastOrgSlug';
// Where to send someone after they sign out or their session ends: their
// own company's login page, never a generic/platform one.
export function getLoginPath() {
  const slug = getLastOrgSlug();
  return slug ? `/${slug}/login` : '/';
}

export function getLastOrgSlug() {
  try {
    return localStorage.getItem(LAST_ORG_SLUG_KEY);
  } catch {
    return null;
  }
}
export function rememberOrgSlug(orgSlug) {
  try {
    localStorage.setItem(LAST_ORG_SLUG_KEY, orgSlug);
  } catch {
    // Private browsing / storage disabled — losing this is a minor UX
    // regression (redirect falls back to the neutral landing page), never
    // a functional break.
  }
}

// The single source of truth for "who is signed in" — every route guard
// and permission-aware nav item reads from here, never from a token/cookie
// directly. On mount it asks the server (GET /auth/me) rather than trusting
// any client-side flag, since the actual credential is an HttpOnly session
// cookie the frontend can't inspect.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'initializing' | 'authenticated' | 'unauthenticated' | 'error'. 'error' means
  // we could not reach the server to find out — which is not the same as
  // signed out, so people are not bounced to the login page by a blip.
  const [authError, setAuthError] = useState(false);
  // Bumped whenever the signed-in user's own avatar changes (see
  // ProfilePictureCard). UserAvatar re-fetches its image whenever the
  // `refreshKey` it's given changes — every instance showing *your own*
  // avatar (Topbar, Settings) is passed this shared counter so uploading a
  // new photo in one place updates all of them, not just the one that
  // triggered the upload.
  // Every "can this person see this control?" check reads the signed-in
  // user's permissions, so they must be in place before anything renders for
  // that user (hence set during render, not in an effect).
  setCurrentPermissions(user?.permissions);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const bumpAvatarVersion = useCallback(() => setAvatarVersion((v) => v + 1), []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
      setAuthError(false);
      return res.data;
    } catch (err) {
      setUser(null);
      setAuthError(err?.statusCode !== 401 && err?.statusCode !== 403);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // Any request that comes back "not signed in" (an expired session) ends the
  // session here, so the route guard sends the person to the login page
  // instead of leaving them on a page full of failed requests.
  useEffect(() => {
    const onExpired = () => setUser((u) => (u ? null : u));
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  // Returns the raw login response so the caller (LoginPage) can branch on
  // `mfaRequired` without this context needing to know about that flow.
  // `orgSlug` identifies which tenant's login this is — see
  // api/tenantAuth.js and server/src/routes/v1/tenantAuth.routes.js.
  const login = useCallback(async (orgSlug, email, password) => {
    const res = await tenantAuthApi.login(orgSlug, { email, password });
    if (res.data.user) {
      setUser(res.data.user);
      rememberOrgSlug(orgSlug);
    }
    return res.data;
  }, []);

  const completeMfaChallenge = useCallback(async (orgSlug, mfaToken, code) => {
    const res = await authApi.mfaChallenge({ mfaToken, code });
    setUser(res.data.user);
    rememberOrgSlug(orgSlug);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const hasRole = useCallback((...roles) => Boolean(user) && roles.some((r) => user.roles.includes(r)), [user]);

  const value = useMemo(
    () => ({
      user, loading, authError, authStatus: loading ? 'initializing' : user ? 'authenticated' : authError ? 'error' : 'unauthenticated', isAuthenticated: Boolean(user), login, completeMfaChallenge, logout, refreshUser, hasRole,
      avatarVersion, bumpAvatarVersion,
    }),
    [user, loading, authError, login, completeMfaChallenge, logout, refreshUser, hasRole, avatarVersion, bumpAvatarVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
