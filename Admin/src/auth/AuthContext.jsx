// This context restores the admin user from the secure server cookie and exposes sign-out.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const response = await api.get('/admin/auth/me');
      setUser(response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        return null;
      }
      throw error;
    }
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post('/admin/auth/login', credentials);
    setUser(response.data);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/admin/auth/logout', {});
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      try {
        await loadUser();
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    restoreSession();
    return () => { mounted = false; };
  }, [loadUser]);

  const value = useMemo(() => ({ user, loading, login, logout, reload: loadUser }), [user, loading, login, logout, loadUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
