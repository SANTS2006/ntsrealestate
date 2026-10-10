import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { platformAdminApi } from '../api/platformAdmin.js';

const PlatformAdminContext = createContext(null);

// Deliberately its own provider/context, never sharing state with
// AuthContext — a platform admin and a tenant user are different actor
// types with different session keys server-side (see
// server/src/middleware/platformAdminAuth.js), and keeping them in
// separate React contexts too means there's no code path where one could
// be mistaken for the other on the client either.
export function PlatformAdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await platformAdminApi.me();
      setAdmin(res.data);
      return res.data;
    } catch {
      setAdmin(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const res = await platformAdminApi.login({ email, password });
    setAdmin(res.data.admin);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await platformAdminApi.logout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = useMemo(
    () => ({ admin, loading, isAuthenticated: Boolean(admin), login, logout, refresh }),
    [admin, loading, login, logout, refresh]
  );

  return <PlatformAdminContext.Provider value={value}>{children}</PlatformAdminContext.Provider>;
}

export function usePlatformAdmin() {
  const ctx = useContext(PlatformAdminContext);
  if (!ctx) throw new Error('usePlatformAdmin must be used within a PlatformAdminProvider');
  return ctx;
}
