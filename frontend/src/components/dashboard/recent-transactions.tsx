'use client';

import Link from 'next/link';
import type { TransactionRowViewModel } from '@/lib/dashboard-controller';
import { NestedTranslations } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

/** Render-only transactions list — rows pre-formatted by the dashboard controller. */
export function RecentTransactions({
  transactions,
  loading,
  t,
}: {
  transactions: TransactionRowViewModel[];
  loading: boolean;
  t: NestedTranslations;
}) {
  const dash = t.dashboard as Record<string, unknown>;
  const nav = t.nav as Record<string, string>;
  const empty = t.empty as Record<string, string>;

  return (
    <Card id="recent-transactions" className="flex h-full flex-col scroll-mt-24">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <Link
          href="/bank-accounts"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <CardTitle className="hover:text-primary">{String(dash.recentTransactions)}</CardTitle>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">{String(dash.loading)}</p>
        ) : transactions.length === 0 ? (
          <EmptyState
            title={String(empty.transactionsTitle ?? empty.ledgerTitle)}
            description={String(empty.transactionsHint ?? empty.ledgerHint)}
            actionLabel={nav.uploads}
            actionHref="/uploads"
          />
        ) : (
          <ul className="space-y-1">
            {transactions.map((txn) => (
              <li
                key={txn.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/20"
              >
                <span
                  className={cn(
                    'h-8 w-1 shrink-0 rounded-full',
                    txn.direction === 'IN' ? 'bg-cash-positive' : 'bg-cash-negative',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{txn.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {txn.categoryLabel}
                    {' · '}
                    {txn.dateDisplay}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      txn.direction === 'IN' ? 'text-cash-positive' : 'text-cash-negative',
                    )}
                  >
                    {txn.amountDisplay}
                  </span>
                  <Badge
                    variant={txn.statusVariant === 'cleared' ? 'cash-positive' : 'warning'}
                    className="text-[10px]"
                  >
                    {txn.statusLabel}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
