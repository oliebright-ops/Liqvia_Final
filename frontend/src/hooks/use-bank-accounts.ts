'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { BankAccountLedgerView, BankAccountsSummary } from '@/lib/module-types';
import { useAuth } from '@/lib/auth-context';
import { onWorkspaceRefresh } from '@/lib/workspace-refresh';

export function useBankAccounts() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<BankAccountsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!user?.companyId) return Promise.resolve();
    setLoading(true);
    setError(null);
    return apiGet<BankAccountsSummary>('/bank-accounts')
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  useEffect(() => {
    if (!user?.companyId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [user?.companyId, refetch]);

  useEffect(() => onWorkspaceRefresh(() => void refetch()), [refetch]);

  return { summary, loading, error, refetch };
}

export function useBankTransactions(bankAccountId: string | null, asOfDate?: string) {
  const [ledger, setLedger] = useState<BankAccountLedgerView | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => onWorkspaceRefresh(() => setRefreshKey((k) => k + 1)), []);

  useEffect(() => {
    if (!bankAccountId) {
      setLedger(null);
      return;
    }
    setLoading(true);
    const qs = asOfDate ? `?asOf=${asOfDate}` : '';
    apiGet<BankAccountLedgerView>(`/bank-accounts/${bankAccountId}/transactions${qs}`)
      .then(setLedger)
      .catch(() => setLedger(null))
      .finally(() => setLoading(false));
  }, [bankAccountId, asOfDate, refreshKey]);

  return { ledger, loading };
}
