'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessRoute, getDefaultAppPath } from '@liqvia2/shared';
import { useAuth } from '@/lib/auth-context';

/** Redirects users away from routes their role cannot access. */
export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user?.role || user.isDemoMode) return;
    if (!canAccessRoute(user.role, pathname)) {
      router.replace(getDefaultAppPath(user.role));
    }
  }, [loading, user, pathname, router]);

  if (!loading && user?.role && !user.isDemoMode && !canAccessRoute(user.role, pathname)) {
    return null;
  }

  return <>{children}</>;
}
