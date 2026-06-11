'use client';

import { useQuery } from '@tanstack/react-query';
import type { FreeCashReport } from '@liqvia2/shared';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { freeCashKey } from '@/lib/query-client';

/** Dedicated free-cash module — recalculates on every horizon change. */
export function useFreeAvailableCash(horizonWeeks: number) {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: freeCashKey(companyId, horizonWeeks),
    queryFn: () =>
      apiGet<FreeCashReport>(
        `/liquidity/free-cash?horizonWeeks=${encodeURIComponent(String(horizonWeeks))}`,
      ),
    enabled: !!companyId && Number.isFinite(horizonWeeks),
  });
}
