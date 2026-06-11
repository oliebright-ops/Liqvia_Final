'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_FORECAST_HORIZON, mergeFreeCashAlerts } from '@liqvia2/shared';
import { useAuth } from '@/lib/auth-context';
import { DEMO_RECENT_TXN } from '@/lib/dashboard-demo-transactions';
import { mapSummaryToDashboardView } from '@/lib/dashboard-controller';
import { useFreeAvailableCash } from '@/hooks/use-free-available-cash';
import { useTreasurySummary } from '@/hooks/use-treasury-summary';
import { useLanguage } from '@/lib/i18n';
import type { SummaryReport } from '@liqvia2/shared';
import { Alert } from '@/components/ui/alert';
import { AiInsightSection } from './ai-insight-section';
import { AlertSection } from './alert-section';
import { DashboardHeader } from './dashboard-header';
import { DashboardLoading } from './dashboard-loading';
import { ForecastSection } from './forecast-section';
import { KpiGrid } from './kpi-grid';
import { RecentTransactions } from './recent-transactions';

/** Demo mode uses live API data; only inject sample transactions when the ledger is empty. */
function withDemoTransactionFallback(summary: SummaryReport, isDemoMode: boolean): SummaryReport {
  if (!isDemoMode || summary.recentTransactions.length > 0) {
    return summary;
  }
  return { ...summary, recentTransactions: DEMO_RECENT_TXN };
}

export function TreasuryDashboard() {
  const { user } = useAuth();
  const { t, format, locale } = useLanguage();
  const [viewHorizonWeeks, setViewHorizonWeeks] = useState<number | undefined>(undefined);
  const { data, loading, error, isFetching } = useTreasurySummary(viewHorizonWeeks);
  const horizonWeeks = viewHorizonWeeks ?? data?.liquidity.horizonWeeks ?? DEFAULT_FORECAST_HORIZON;
  const { data: freeCash, isFetching: freeCashFetching } = useFreeAvailableCash(horizonWeeks);

  const txnCategoryLabels = (t.dashboard as Record<string, unknown>).txnCategories as Record<
    string,
    string
  >;

  const view = useMemo(() => {
    if (!data) return null;
    const summary = withDemoTransactionFallback(data, user?.isDemoMode ?? false);
    const merged =
      freeCash != null
        ? {
            ...summary,
            liquidity: {
              ...summary.liquidity,
              horizonWeeks: freeCash.horizonWeeks,
              freeAvailableCash: freeCash.freeAvailableCash,
              fixedOutflowsHorizon: freeCash.fixedOutflowsHorizon,
            },
          }
        : summary;
    const withAlerts =
      freeCash != null
        ? {
            ...merged,
            alerts: mergeFreeCashAlerts(
              merged.alerts,
              freeCash.freeAvailableCash,
              merged.cash.total,
              freeCash.horizonWeeks,
            ),
          }
        : merged;
    return mapSummaryToDashboardView(withAlerts, format, locale, txnCategoryLabels, horizonWeeks);
  }, [data, freeCash, user?.isDemoMode, format, locale, txnCategoryLabels, horizonWeeks]);

  if (error) {
    return <Alert variant="error">{format('errors.loadFailed')}</Alert>;
  }

  if (loading || !view) {
    return <DashboardLoading />;
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        companyName={view.companyName}
        asOfDate={view.asOfDate}
        totalCashDisplay={view.totalCashDisplay}
        accountCountSubtitle={view.accountCountSubtitle}
        reconciliationPending={view.reconciliationPending}
        horizonWeeks={horizonWeeks}
        onHorizonChange={setViewHorizonWeeks}
        t={t}
        format={format}
      />

      {(isFetching || freeCashFetching) && !loading && (
        <p className="text-xs text-muted-foreground">{format('dashboard.refreshing')}</p>
      )}

      <KpiGrid cards={view.kpiCards} format={format} />

      <div className="grid gap-6 lg:grid-cols-3">
        <ForecastSection
          forecast={view.forecast}
          horizonWeeks={horizonWeeks}
          currency={view.currency}
          t={t}
          format={format}
        />
        <AlertSection
          alerts={view.alerts}
          liquidityStatus={view.liquidityStatus}
          currency={view.currency}
          t={t}
          format={format}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions transactions={view.recentTransactions} loading={false} t={t} />
        <AiInsightSection companyId={view.companyId} t={t} />
      </div>
    </div>
  );
}
