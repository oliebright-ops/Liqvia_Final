'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasFullAccess, hasPermission, type AppPermission } from '@liqvia2/shared';
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
  enterDemoMode: (companyId?: string) => Promise<void>;
  exploreDemo: (companyId?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  applyAuthResponse: (res: AuthResponse) => Promise<void>;
  isAdmin: boolean;
  can: (permission: AppPermission) => boolean;
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
    } catch (err) {
      // Only a genuine 401/403 means the token itself is invalid — clear the session
      // then. Any other failure (network hiccup, cold-start 5xx, rate limit) is
      // transient and unrelated to whether the session is valid; wiping the session
      // on those previously forced a fresh login on direct navigation to a protected
      // route whenever this call raced a slow/cold backend. See F21.
      const status = (err as Error & { status?: number })?.status;
      if (status === 401 || status === 403) {
        clearAuthSession();
        setUser(null);
      } else {
        setUser(getStoredUser());
      }
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

  const enterDemoMode = useCallback(
    async (companyId?: string) => {
      const res = await apiPost<AuthResponse>('/onboarding/demo-mode', companyId ? { companyId } : {});
      await applyAuthResponse(res);
      router.push('/dashboard');
    },
    [router, applyAuthResponse],
  );

  const exploreDemo = useCallback(
    async (companyId?: string) => {
      if (user) {
        await enterDemoMode(companyId);
        return;
      }
      const res = await apiPost<AuthResponse>('/auth/demo-guest', companyId ? { companyId } : {});
      await applyAuthResponse(res);
      router.push('/dashboard');
    },
    [user, enterDemoMode, applyAuthResponse, router],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    router.push('/');
  }, [router]);

  const can = useCallback(
    (permission: AppPermission) => (user?.role ? hasPermission(user.role, permission) : false),
    [user?.role],
  );

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
      isAdmin: user?.role ? hasFullAccess(user.role) : false,
      can,
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
      can,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
