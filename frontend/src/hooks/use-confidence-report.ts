'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { confidenceReportKey } from '@/lib/query-client';
import type { ConfidenceReportView } from '@/lib/module-types';

export function useConfidenceReport() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: confidenceReportKey(companyId),
    queryFn: () => apiGet<ConfidenceReportView>('/data-quality/confidence'),
    enabled: !!companyId,
  });
}
