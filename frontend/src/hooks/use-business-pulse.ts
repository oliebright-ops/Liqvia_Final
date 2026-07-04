'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import { businessPulseKey } from '@/lib/query-client';
import type { BusinessPulseReportView } from '@/lib/module-types';

export function useBusinessPulse() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...businessPulseKey(companyId), locale],
    queryFn: () => apiGet<BusinessPulseReportView>(`/business-pulse?locale=${encodeURIComponent(locale)}`),
    enabled: !!companyId,
  });
}
