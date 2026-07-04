'use client';

import { useQuery } from '@tanstack/react-query';
import { CashDrivenDashboardView } from '@/lib/module-types';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export function useCashDrivenDashboard(enabled: boolean) {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  const query = useQuery({
    queryKey: ['cash-driven-dashboard', companyId],
    queryFn: () => apiGet<CashDrivenDashboardView>('/cash-driven/dashboard'),
    enabled: !!companyId && enabled,
  });

  return { data: query.data ?? null, isLoading: query.isLoading };
}
