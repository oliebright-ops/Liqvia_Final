'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useForecastModel } from '@/hooks/use-forecast-model';
import { ForecastAreaChart } from '@/components/charts/forecast-area-chart';
import { ForecastGrid } from '@/components/forecast/forecast-grid';
import { ForecastSummary } from '@/components/forecast/forecast-summary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from './page-header';
import { useLanguage } from '@/lib/i18n';

export function CashForecastPage() {
  const { t, format } = useLanguage();
  const chart = t.chart as Record<string, string>;
  const dash = t.dashboard as Record<string, string>;
  const fc = t.forecast as Record<string, string>;
  const empty = t.empty as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const { user } = useAuth();
  const { model, currency, loading, refetch } = useForecastModel();
  const [locking, setLocking] = useState(false);
  const [lockedActive, setLockedActive] = useState(false);

  async function lockVersion() {
    if (!user?.companyId) return;
    setLocking(true);
    try {
      await apiPost(`/treasury/forecast/${user.companyId}/generate`, {});
      setLockedActive(true);
      await refetch();
    } finally {
      setLocking(false);
    }
  }

  if (loading || !model) {
    return <p className="text-sm text-muted-foreground">{dash.loading}</p>;
  }

  const { weeks } = model;
  const chartLines = weeks.map((w) => ({
    weekIndex: w.weekIndex,
    weekStart: w.weekStart,
    openingCash: w.openingCash,
    forecastInflows: w.forecastInflows,
    forecastOutflows: w.forecastOutflows,
    closingCash: w.closingCash,
    liquidityStatus: w.liquidityStatus,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={nav.forecast}
        subtitle={fc.pageSubtitle}
        meta={lockedActive ? fc.lockedVersion : fc.liveVersion}
      />

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void lockVersion()} disabled={locking} className="gap-2">
          <Lock className="h-4 w-4" />
          {locking ? fc.locking : fc.lockVersion}
        </Button>
        {lockedActive && <Badge variant="success">{fc.versionLocked}</Badge>}
      </div>

      <ForecastSummary model={model} currency={currency} t={t} format={format} />

      <Card>
        <CardHeader>
          <CardTitle>{dash.forecastTitle}</CardTitle>
          <CardDescription>{dash.forecastHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {weeks.length === 0 ? (
            <EmptyState
              title={empty.forecastTitle}
              description={empty.forecastHint}
              actionLabel={nav.uploads}
              actionHref="/uploads"
            />
          ) : (
            <ForecastAreaChart
              lines={chartLines}
              currency={currency}
              labels={{ closing: chart.closingCash, weekPrefix: chart.weekPrefix }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{fc.gridTitle}</CardTitle>
          <CardDescription>{fc.gridHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {weeks.length === 0 ? (
            <EmptyState
              title={empty.forecastTitle}
              description={empty.forecastHint}
              actionLabel={nav.uploads}
              actionHref="/uploads"
            />
          ) : (
            <ForecastGrid weeks={weeks} currency={currency} t={t} format={format} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
