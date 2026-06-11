'use client';

import type { ForecastModelResult } from '@liqvia2/shared';
import { useTreasurySummary } from '@/hooks/use-treasury-summary';

/**
 * Forecast model sourced from the unified treasury controller (SummaryReport.forecastModel).
 * No client-side financial calculations — same engine output as Cash Forecast page.
 */
export function useForecastModel(): {
  model: ForecastModelResult | null;
  currency: string;
  asOfDate: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { data: summary, loading, error, refetch } = useTreasurySummary();

  return {
    model: summary?.forecastModel ?? null,
    currency: summary?.currency ?? 'USD',
    asOfDate: summary?.asOfDate ?? '',
    loading,
    error,
    refetch,
  };
}
