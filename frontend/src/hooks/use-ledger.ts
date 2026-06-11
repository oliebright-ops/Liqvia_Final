'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { onWorkspaceRefresh } from '@/lib/workspace-refresh';
import { LedgerPayload } from '@/lib/ledger-types';

export function useLedger() {
  const { user } = useAuth();
  const [data, setData] = useState<LedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!user?.companyId) return Promise.resolve();
    setLoading(true);
    setError(null);
    return apiGet<LedgerPayload>('/ledger')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load ledger'))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  useEffect(() => {
    if (!user?.companyId) {
      setData(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [user?.companyId, refetch]);

  useEffect(() => onWorkspaceRefresh(() => void refetch()), [refetch]);

  return { data, loading, error, refetch };
}
