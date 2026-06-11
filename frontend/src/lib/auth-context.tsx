'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from './api';
import { AuthResponse, AuthUser, resolvePostAuthPath } from './auth-types';
import { clearAuthSession, getAccessToken, getStoredUser, setAuthSession } from './auth-storage';
import { notifyWorkspaceRefresh } from './workspace-refresh';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  enterDemoMode: () => Promise<void>;
  exploreDemo: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  applyAuthResponse: (res: AuthResponse) => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuthResponse = useCallback(async (res: AuthResponse) => {
    setAuthSession(res.accessToken, res.user);
    const me = await apiGet<AuthUser>('/auth/me');
    setAuthSession(res.accessToken, me);
    setUser(me);
    return;
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await apiGet<AuthUser>('/auth/me');
      setUser(me);
      setAuthSession(token, me);
    } catch {
      clearAuthSession();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<AuthResponse>('/auth/login', { email, password });
      await applyAuthResponse(res);
      const me = await apiGet<AuthUser>('/auth/me');
      router.push(resolvePostAuthPath(me));
    },
    [router, applyAuthResponse],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const res = await apiPost<AuthResponse>('/auth/register', input);
      await applyAuthResponse(res);
      router.push('/onboarding');
    },
    [router, applyAuthResponse],
  );

  const selectCompany = useCallback(
    async (companyId: string) => {
      const res = await apiPost<AuthResponse>('/onboarding/select-company', {
        companyId,
      });
      await applyAuthResponse(res);
      notifyWorkspaceRefresh();
      const me = await apiGet<AuthUser>('/auth/me');
      setUser(me);
      setAuthSession(res.accessToken, me);
      router.push(resolvePostAuthPath(me));
      router.refresh();
    },
    [router, applyAuthResponse],
  );

  const enterDemoMode = useCallback(async () => {
    const res = await apiPost<AuthResponse>('/onboarding/demo-mode', {});
    await applyAuthResponse(res);
    router.push('/dashboard');
  }, [router, applyAuthResponse]);

  const exploreDemo = useCallback(async () => {
    if (user) {
      await enterDemoMode();
      return;
    }
    const res = await apiPost<AuthResponse>('/auth/demo-guest', {});
    await applyAuthResponse(res);
    router.push('/dashboard');
  }, [user, enterDemoMode, applyAuthResponse, router]);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    router.push('/');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      selectCompany,
      enterDemoMode,
      exploreDemo,
      logout,
      refreshUser,
      applyAuthResponse,
      isAdmin: user?.role === 'admin' || user?.role === 'owner',
    }),
    [
      user,
      loading,
      login,
      register,
      selectCompany,
      enterDemoMode,
      exploreDemo,
      logout,
      refreshUser,
      applyAuthResponse,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
