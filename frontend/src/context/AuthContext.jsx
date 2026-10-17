// Phase 1: Share the logged-in member and account actions across the website.
import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../lib/apiClient.js';
import AuthContext from './auth-context.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const result = await apiClient.get('/auth/me');
      setUser(result.user);
      return result.user;
    } catch (error) {
      if (error.status === 401) {
        try {
          const onboarding = await apiClient.get('/auth/onboarding/me');
          setUser(onboarding.user);
          return onboarding.user;
        } catch (onboardingError) {
          setUser(null);
          if (onboardingError.status === 401) return null;
          throw onboardingError;
        }
      }
      setUser(null);
      throw error;
    }
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await apiClient.post('/auth/login', credentials);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refreshUser()
      .catch((error) => console.error('[auth] Could not restore the current session:', error.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refreshUser,
  }), [user, loading, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
