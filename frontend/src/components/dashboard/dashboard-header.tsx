'use client';

import Link from 'next/link';
import { NestedTranslations, TranslateFn } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { HorizonControl } from './horizon-control';

export function DashboardHeader({
  companyName,
  asOfDate,
  totalCashDisplay,
  accountCountSubtitle,
  reconciliationPending,
  horizonWeeks,
  onHorizonChange,
  t,
  format,
}: {
  companyName: string;
  asOfDate: string;
  totalCashDisplay: string;
  accountCountSubtitle: string;
  reconciliationPending: boolean;
  horizonWeeks: number;
  onHorizonChange: (weeks: number) => void;
  t: NestedTranslations;
  format: TranslateFn;
}) {
  const dash = t.dashboard as Record<string, string>;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">
          {companyName}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          {dash.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{dash.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href="/bank-accounts"
            className="rounded-lg transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {dash.totalCash}
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {totalCashDisplay}
            </p>
            <p className="text-xs text-muted-foreground">{accountCountSubtitle}</p>
          </Link>
          {reconciliationPending && (
            <Badge variant="warning" className="text-[10px]">
              {dash.reconciliationPending}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <HorizonControl
          horizonWeeks={horizonWeeks}
          onHorizonChange={onHorizonChange}
          format={format}
        />
        <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          {format('dashboard.asOf', { date: asOfDate })}
        </span>
      </div>
    </div>
  );
}
