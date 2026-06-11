'use client';

import { ForecastModelResult } from '@/lib/forecast-types';
import { formatMoney, liquidityVariant } from '@/lib/dashboard-types';
import { NestedTranslations, TranslateFn } from '@/lib/i18n';
import { liquidityLabel } from '@/lib/liquidity-labels';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ForecastSummary({
  model,
  currency,
  t,
  format,
}: {
  model: ForecastModelResult;
  currency: string;
  t: NestedTranslations;
  format: TranslateFn;
}) {
  const dash = t.dashboard as Record<string, string>;
  const fc = t.forecast as Record<string, string>;

  const cards = [
    {
      label: dash.currentCash,
      value: formatMoney(currency, model.openingCash),
      negative: model.openingCash < 0,
    },
    {
      label: dash.week13,
      value: formatMoney(currency, model.projectedClosing),
      negative: (model.projectedClosing ?? 0) < 0,
    },
    {
      label: fc.netCashFlow,
      value: formatMoney(
        currency,
        (model.projectedClosing ?? 0) - model.openingCash,
      ),
      negative: (model.projectedClosing ?? 0) < model.openingCash,
    },
    {
      label: dash.liquidity,
      value: liquidityLabel(format, model.executiveLiquidity),
      badge: model.executiveLiquidity,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            {card.badge ? (
              <div className="mt-2">
                <Badge variant={liquidityVariant(card.badge)} className="text-sm">
                  {card.value}
                </Badge>
              </div>
            ) : (
              <p
                className={cn(
                  'mt-2 font-mono text-2xl font-semibold tabular-nums',
                  card.negative ? 'text-cash-negative' : 'text-foreground',
                )}
              >
                {card.value}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
