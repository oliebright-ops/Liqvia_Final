'use client';

import { useEffect, useState } from 'react';
import { useBankAccounts, useBankTransactions } from '@/hooks/use-bank-accounts';
import { useTreasurySummary } from '@/hooks/use-treasury-summary';
import { formatCurrency } from '@liqvia2/shared';
import { useLanguage } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FinancialTable } from '@/components/ui/financial-table';
import { PageHeader } from '@/components/treasury/page-header';
import { translateBankAccountName } from '@/lib/bank-account-labels';
import { cn } from '@/lib/utils';

export function BankAccountsPage() {
  const { t, format } = useLanguage();
  const mod = t.modules as Record<string, Record<string, string>>;
  const bank = mod.bankAccounts;
  const { summary, loading, error } = useBankAccounts();
  const { data: treasury } = useTreasurySummary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeAccountId =
    selectedId ?? (summary && summary.accounts.length > 0 ? summary.accounts[0].id : null);
  const { ledger, loading: txLoading } = useBankTransactions(activeAccountId, treasury?.asOfDate);

  const txnCategories = (t.dashboard as Record<string, unknown>).txnCategories as Record<
    string,
    string
  >;

  useEffect(() => {
    if (!selectedId && summary?.accounts[0]) {
      setSelectedId(summary.accounts[0].id);
    }
  }, [summary, selectedId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{format('dashboard.loading')}</p>;
  }

  if (error || !summary) {
    return <p className="text-sm text-cash-negative">{error ?? format('errors.loadFailed')}</p>;
  }

  const selected =
    summary.accounts.find((a) => a.id === activeAccountId) ?? summary.accounts[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title={bank.title} subtitle={bank.subtitle} />

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {bank.aggregateCash}
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {formatCurrency(summary.aggregateBalance, summary.currency, { compact: true })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {format('dashboard.acrossBankAccounts', { count: String(summary.accountCount) })}
            {summary.aggregateOpeningBalance > 0 && (
              <span className="ml-2">
                · {bank.openingBalance}:{' '}
                {formatCurrency(summary.aggregateOpeningBalance, summary.currency, {
                  compact: true,
                })}
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {summary.accounts.length === 0 ? (
        <EmptyState
          title={bank.emptyTitle}
          description={bank.emptyHint}
          actionLabel={(t.nav as Record<string, string>).uploads}
          actionHref="/uploads"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summary.accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedId(acc.id)}
                className={cn(
                  'rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40',
                  selected?.id === acc.id && 'border-primary/50 ring-1 ring-primary/30',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {translateBankAccountName(acc.accountName, format)}
                    </p>
                    <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                  </div>
                  <Badge variant={acc.status === 'active' ? 'cash-positive' : 'warning'}>
                    {acc.status === 'active' ? bank.statusActive : bank.statusInactive}
                  </Badge>
                </div>
                <p className="mt-3 font-mono text-xl font-semibold tabular-nums">
                  {formatCurrency(acc.currentBalance, acc.currency, { compact: true })}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">{acc.accountNumberMasked}</p>
              </button>
            ))}
          </div>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>{bank.recentTransactions}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {txLoading ? (
                  <p className="text-xs text-muted-foreground">{format('dashboard.loading')}</p>
                ) : (
                  <>
                    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {bank.openingBalance}
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                          {formatCurrency(
                            ledger?.openingBalance ?? selected.openingBalance,
                            selected.currency,
                          )}
                        </p>
                        {ledger?.openingDate && (
                          <p className="text-[10px] text-muted-foreground">{ledger.openingDate}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {bank.netMovement}
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                          {formatCurrency(
                            (ledger?.closingBalance ?? selected.currentBalance) -
                              (ledger?.openingBalance ?? selected.openingBalance),
                            selected.currency,
                            { signed: true },
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {bank.closingBalance}
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                          {formatCurrency(
                            ledger?.closingBalance ?? selected.currentBalance,
                            selected.currency,
                          )}
                        </p>
                      </div>
                    </div>

                    {!ledger || ledger.transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{bank.noTransactions}</p>
                    ) : (
                      <FinancialTable
                        rows={ledger.transactions}
                        rowKey={(r) => r.id}
                        columns={[
                          {
                            key: 'date',
                            header: bank.colDate,
                            render: (r) => r.transactionDate,
                            muted: true,
                          },
                          {
                            key: 'desc',
                            header: bank.colDescription,
                            render: (r) => r.description,
                          },
                          {
                            key: 'cat',
                            header: bank.colCategory,
                            muted: true,
                            render: (r) => txnCategories[r.category] ?? r.category,
                          },
                          {
                            key: 'amount',
                            header: bank.colAmount,
                            align: 'right',
                            mono: true,
                            render: (r) => (
                              <span
                                className={
                                  r.direction === 'IN' ? 'text-cash-positive' : 'text-cash-negative'
                                }
                              >
                                {r.direction === 'IN' ? '+' : '−'}
                                {formatCurrency(r.amount, selected.currency)}
                              </span>
                            ),
                          },
                          {
                            key: 'balance',
                            header: bank.colRunningBalance,
                            align: 'right',
                            mono: true,
                            render: (r) => formatCurrency(r.runningBalance, selected.currency),
                          },
                          {
                            key: 'status',
                            header: bank.colStatus,
                            render: (r) => (
                              <Badge
                                variant={r.status === 'cleared' ? 'cash-positive' : 'warning'}
                                className="text-[10px]"
                              >
                                {r.status === 'cleared'
                                  ? format('dashboard.txnCleared')
                                  : format('dashboard.txnPending')}
                              </Badge>
                            ),
                          },
                        ]}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
