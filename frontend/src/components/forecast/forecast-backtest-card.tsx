'use client';

import type { ForecastBacktestResult } from '@liqvia2/shared';
import { formatMoney } from '@/lib/dashboard-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n';

const QUALITY_VARIANT: Record<
  ForecastBacktestResult['quality'],
  'default' | 'muted' | 'success'
> = {
  insufficient: 'muted',
  partial: 'default',
  good: 'success',
};

export function ForecastBacktestCard({
  backtest,
  currency,
}: {
  backtest: ForecastBacktestResult;
  currency: string;
}) {
  const t = useTranslations();
  const bt = {
    title: t('forecast.backtest.title'),
    subtitle: t('forecast.backtest.subtitle'),
    insufficientHint: t('forecast.backtest.insufficientHint'),
    netWeeks: t('forecast.backtest.netWeeks'),
    netWeeksHint: t('forecast.backtest.netWeeksHint'),
    netError: t('forecast.backtest.netError'),
    netErrorHint: t('forecast.backtest.netErrorHint'),
    netErrorPct: t('forecast.backtest.netErrorPct'),
    netErrorPctHint: t('forecast.backtest.netErrorPctHint'),
    budgetErrorPct: t('forecast.backtest.budgetErrorPct'),
    budgetErrorPctHint: t('forecast.backtest.budgetErrorPctHint'),
    notAvailable: t('forecast.backtest.notAvailable'),
    recentWeeks: t('forecast.backtest.recentWeeks'),
    colPeriod: t('forecast.backtest.colPeriod'),
    colPredicted: t('forecast.backtest.colPredicted'),
    colActual: t('forecast.backtest.colActual'),
    colError: t('forecast.backtest.colError'),
    quality_insufficient: t('forecast.backtest.quality_insufficient'),
    quality_partial: t('forecast.backtest.quality_partial'),
    quality_good: t('forecast.backtest.quality_good'),
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{bt.title}</CardTitle>
          <Badge variant={QUALITY_VARIANT[backtest.quality]}>
            {bt[`quality_${backtest.quality}`]}
          </Badge>
        </div>
        <CardDescription>{bt.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {backtest.quality === 'insufficient' ? (
          <p className="text-sm text-muted-foreground">{bt.insufficientHint}</p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={bt.netWeeks}
                value={String(backtest.netCashWeeks)}
                hint={bt.netWeeksHint.replace('{weeks}', String(backtest.lookbackWeeks))}
              />
              <Metric
                label={bt.netError}
                value={
                  backtest.meanAbsoluteNetError !== null
                    ? formatMoney(currency, backtest.meanAbsoluteNetError)
                    : bt.notAvailable
                }
                hint={bt.netErrorHint}
              />
              <Metric
                label={bt.netErrorPct}
                value={
                  backtest.meanAbsoluteNetErrorPercent !== null
                    ? `${backtest.meanAbsoluteNetErrorPercent}%`
                    : bt.notAvailable
                }
                hint={bt.netErrorPctHint}
              />
              <Metric
                label={bt.budgetErrorPct}
                value={
                  backtest.meanAbsoluteBudgetErrorPercent !== null
                    ? `${backtest.meanAbsoluteBudgetErrorPercent}%`
                    : bt.notAvailable
                }
                hint={bt.budgetErrorPctHint.replace(
                  '{count}',
                  String(backtest.budgetVarianceLineCount),
                )}
              />
            </dl>

            {backtest.sampleNetWeeks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{bt.recentWeeks}</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">{bt.colPeriod}</th>
                        <th className="pb-2 pr-3 font-medium">{bt.colPredicted}</th>
                        <th className="pb-2 pr-3 font-medium">{bt.colActual}</th>
                        <th className="pb-2 font-medium">{bt.colError}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtest.sampleNetWeeks.map((row) => (
                        <tr key={row.period} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-mono tabular-nums">{row.period}</td>
                          <td className="py-2 pr-3 font-mono tabular-nums">
                            {formatMoney(currency, row.predictedNet)}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums">
                            {formatMoney(currency, row.actualNet)}
                          </td>
                          <td className="py-2 font-mono tabular-nums">
                            {formatMoney(currency, row.error)}
                            {row.errorPercent !== null ? ` (${row.errorPercent}%)` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}
