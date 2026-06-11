'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SummaryReport } from '@liqvia2/shared';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { treasurySummaryKey } from '@/lib/query-client';
import { onWorkspaceRefresh } from '@/lib/workspace-refresh';

/** Fetches the unified SummaryReport from the treasury data controller. */
export function useTreasurySummary(horizonWeeks?: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = user?.companyId ?? null;

  const query = useQuery({
    queryKey: treasurySummaryKey(companyId, horizonWeeks),
    queryFn: () => {
      const params =
        horizonWeeks !== undefined
          ? `?horizonWeeks=${encodeURIComponent(String(horizonWeeks))}`
          : '';
      return apiGet<SummaryReport>(`/dashboard${params}`);
    },
    enabled: !!companyId,
  });

  const refetch = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!companyId) return;
      if (options?.silent) {
        await queryClient.refetchQueries({
          queryKey: treasurySummaryKey(companyId, horizonWeeks),
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: treasurySummaryKey(companyId, horizonWeeks),
        });
      }
    },
    [companyId, horizonWeeks, queryClient],
  );

  useEffect(() => onWorkspaceRefresh(() => void refetch({ silent: true })), [refetch]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load' : null,
    refetch,
  };
}
