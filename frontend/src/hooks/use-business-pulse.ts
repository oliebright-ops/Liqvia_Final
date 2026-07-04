'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { businessPulseKey } from '@/lib/query-client';
import type { BusinessPulseReportView } from '@/lib/module-types';

export function useBusinessPulse() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: businessPulseKey(companyId),
    queryFn: () => apiGet<BusinessPulseReportView>('/business-pulse'),
    enabled: !!companyId,
  });
}
