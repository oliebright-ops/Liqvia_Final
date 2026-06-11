'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { WeeklyForecastDetail } from '@/lib/forecast-types';
import { formatMoney, liquidityVariant } from '@/lib/dashboard-types';
import { NestedTranslations, TranslateFn } from '@/lib/i18n';
import { liquidityLabel } from '@/lib/liquidity-labels';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ForecastGrid({
  weeks,
  currency,
  t,
  format,
}: {
  weeks: WeeklyForecastDetail[];
  currency: string;
  t: NestedTranslations;
  format: TranslateFn;
}) {
  const dash = t.dashboard as Record<string, string>;
  const fc = t.forecast as Record<string, string>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card pb-2 pr-4 text-left font-medium">
              {dash.week}
            </th>
            <th className="pb-2 pr-4 text-right font-medium">{dash.opening}</th>
            <th className="pb-2 pr-4 text-right font-medium">{dash.inflows}</th>
            <th className="pb-2 pr-4 text-right font-medium">{dash.outflows}</th>
            <th className="pb-2 pr-4 text-right font-medium">{fc.netCashFlow}</th>
            <th className="pb-2 pr-4 text-right font-medium">{dash.closing}</th>
            <th className="pb-2 text-left font-medium">{dash.liquidity}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((row) => {
            const arCount = row.entries.filter((e) => e.type === 'receivable').length;
            const apCount = row.entries.filter((e) => e.type === 'payable').length;
            return (
              <tr key={row.weekIndex} className="border-b border-border/60">
                <td className="sticky left-0 z-10 bg-card py-2.5 pr-4 font-medium text-foreground">
                  {row.weekIndex}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                  {formatMoney(currency, row.openingCash)}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <FlowCell
                    amount={row.forecastInflows}
                    currency={currency}
                    positive
                    entryCount={arCount}
                    entryLabel={format('forecast.arEntries', { count: String(arCount) })}
                    hasArAp={row.arApInflows > 0}
                  />
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <FlowCell
                    amount={row.forecastOutflows}
                    currency={currency}
                    entryCount={apCount}
                    entryLabel={format('forecast.apEntries', { count: String(apCount) })}
                    hasArAp={row.arApOutflows > 0}
                  />
                </td>
                <td
                  className={cn(
                    'py-2.5 pr-4 text-right font-mono tabular-nums',
                    row.netCashFlow >= 0 ? 'text-cash-positive' : 'text-cash-negative',
                  )}
                >
                  {formatMoney(currency, row.netCashFlow)}
                </td>
                <td
                  className={cn(
                    'py-2.5 pr-4 text-right font-mono tabular-nums',
                    row.closingCash < 0 && 'text-cash-negative',
                  )}
                >
                  {formatMoney(currency, row.closingCash)}
                </td>
                <td className="py-2.5">
                  <Badge variant={liquidityVariant(row.liquidityStatus)}>
                    {liquidityLabel(format, row.liquidityStatus)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FlowCell({
  amount,
  currency,
  positive,
  entryCount,
  entryLabel,
  hasArAp,
}: {
  amount: number;
  currency: string;
  positive?: boolean;
  entryCount: number;
  entryLabel: string;
  hasArAp: boolean;
}) {
  if (amount === 0) {
    return <span className="font-mono tabular-nums text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          'font-mono tabular-nums',
          positive ? 'text-cash-positive' : 'text-foreground',
          hasArAp && 'text-primary/90',
        )}
      >
        {formatMoney(currency, amount)}
      </span>
      {entryCount > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {positive ? (
            <ArrowUpRight className="h-3 w-3 text-cash-positive" />
          ) : (
            <ArrowDownLeft className="h-3 w-3 text-cash-negative" />
          )}
          {entryLabel}
        </span>
      )}
    </div>
  );
}
