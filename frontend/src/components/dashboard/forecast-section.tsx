'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { WeeklyForecastLine } from '@/lib/dashboard-types';
import { NestedTranslations, TranslateFn } from '@/lib/i18n';
import { ForecastComposedChart } from '@/components/charts/forecast-composed-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

function isW1InflowOutlier(lines: WeeklyForecastLine[]): boolean {
  const w1 = lines.find((l) => l.weekIndex === 1);
  if (!w1 || lines.length < 3) return false;
  const peerMax = Math.max(
    ...lines.filter((l) => l.weekIndex !== 1).map((l) => l.forecastInflows),
    0,
  );
  return peerMax > 0 && w1.forecastInflows > peerMax * 2;
}

export function ForecastSection({
  forecast,
  horizonWeeks,
  currency,
  t,
  format,
}: {
  forecast: WeeklyForecastLine[];
  horizonWeeks: number;
  currency: string;
  t: NestedTranslations;
  format: TranslateFn;
}) {
  const dash = t.dashboard as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const chart = t.chart as Record<string, string>;
  const empty = t.empty as Record<string, string>;
  const [excludeW1, setExcludeW1] = useState(false);

  const w1Outlier = useMemo(() => isW1InflowOutlier(forecast), [forecast]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <Link
          href="/forecast"
          className="group min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <CardTitle className="group-hover:text-primary">
            {format('dashboard.forecastTitleDynamic', { weeks: String(horizonWeeks) })}
          </CardTitle>
          <CardDescription>{dash.forecastHint}</CardDescription>
        </Link>
        <Link href="/forecast">
          <Button variant="outline" className="text-xs shadow-glow-primary">
            {nav.forecast} →
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {forecast.length === 0 ? (
          <EmptyState
            title={empty.forecastTitle}
            description={empty.forecastHint}
            actionLabel={nav.uploads}
            actionHref="/uploads"
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{chart.scaleHint}</p>
              <Button
                type="button"
                variant={excludeW1 ? 'primary' : 'outline'}
                className="h-8 px-3 text-xs"
                onClick={() => setExcludeW1((v) => !v)}
                aria-pressed={excludeW1}
                title={w1Outlier ? chart.excludeW1Hint : chart.excludeW1HintInactive}
              >
                {chart.excludeW1}
              </Button>
            </div>
            <Link
              href="/forecast"
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ForecastComposedChart
                lines={forecast}
                currency={currency}
                height={320}
                excludeW1={excludeW1}
                labels={{
                  closing: chart.closingCash,
                  inflows: chart.inflows,
                  outflows: chart.outflows,
                  openingBalance: chart.openingBalanceInflow,
                  weekPrefix: chart.weekPrefix,
                }}
              />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
