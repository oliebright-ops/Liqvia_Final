'use client';

import { useQuery } from '@tanstack/react-query';
import { CompanySettings } from '@/lib/module-types';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export function useCompanySettings() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  const query = useQuery({
    queryKey: ['company-settings', companyId],
    queryFn: () => apiGet<CompanySettings>('/settings/company'),
    enabled: !!companyId,
  });

  return { settings: query.data ?? null, isLoading: query.isLoading };
}
