'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/** Redirect authenticated users without a workspace to onboarding. */
export function RequireWorkspace({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !user.companyId && !user.isDemoMode) {
      router.replace('/onboarding');
    }
  }, [loading, user, router]);

  if (loading) return null;
  if (!user) return null;
  if (!user.companyId && !user.isDemoMode) return null;
  return <>{children}</>;
}
