'use client';

import type { SummaryReport } from '@liqvia2/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/dashboard-types';
import { useTranslations } from '@/lib/i18n';

export function FreeCashBreakdownPanel({ summary }: { summary: SummaryReport }) {
  const t = useTranslations();
  const { cash, liquidity, currency } = summary;
  const horizon = liquidity.horizonWeeks;

  const lines = [
    {
      label: t('forecast.freeCashBreakdown.openingCash'),
      value: cash.total,
      sign: '+' as const,
    },
    {
      label: t('forecast.freeCashBreakdown.apOutflows'),
      value: liquidity.apOutflowsHorizon,
      sign: '−' as const,
    },
    {
      label: t('forecast.freeCashBreakdown.recurringOutflows'),
      value: liquidity.recurringOutflowsHorizon,
      sign: '−' as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('forecast.freeCashBreakdown.title')}</CardTitle>
        <CardDescription>
          {t('forecast.freeCashBreakdown.subtitle', { horizon: String(horizon) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('forecast.freeCashBreakdown.explainer')}
        </p>
        <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-sm">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-4 py-1.5">
              <span className="text-xs text-muted-foreground">{line.label}</span>
              <span className="tabular-nums text-foreground">
                {line.sign}
                {formatMoney(currency, line.value)}
              </span>
            </div>
          ))}
          <div className="my-2 border-t border-border" />
          <div className="flex items-center justify-between gap-4 py-1.5 font-semibold">
            <span className="text-xs text-foreground">{t('forecast.freeCashBreakdown.result')}</span>
            <span
              className={`tabular-nums ${
                liquidity.freeAvailableCash < 0 ? 'text-cash-negative' : 'text-foreground'
              }`}
            >
              {formatMoney(currency, liquidity.freeAvailableCash)}
            </span>
          </div>
        </div>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>{t('forecast.freeCashBreakdown.noteAp')}</li>
          <li>{t('forecast.freeCashBreakdown.noteRecurring')}</li>
          <li>{t('forecast.freeCashBreakdown.noteNotIncluded')}</li>
        </ul>
      </CardContent>
    </Card>
  );
}
