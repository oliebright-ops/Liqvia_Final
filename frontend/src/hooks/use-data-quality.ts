'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { dataQualityKey } from '@/lib/query-client';
import type { DataQualityReportView } from '@/lib/module-types';

export function useDataQuality() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: dataQualityKey(companyId),
    queryFn: () => apiGet<DataQualityReportView>('/data-quality'),
    enabled: !!companyId,
  });
}
