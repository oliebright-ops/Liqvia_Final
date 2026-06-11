'use client';

import Link from 'next/link';
import { WeeklyForecastLine } from '@/lib/dashboard-types';
import { NestedTranslations, TranslateFn } from '@/lib/i18n';
import { ForecastComposedChart } from '@/components/charts/forecast-composed-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

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
          <Link
            href="/forecast"
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ForecastComposedChart
              lines={forecast}
              currency={currency}
              height={320}
              labels={{
                closing: chart.closingCash,
                inflows: chart.inflows,
                outflows: chart.outflows,
                weekPrefix: chart.weekPrefix,
              }}
            />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
