'use client';

import { useMemo, useState } from 'react';
import { useLedger } from '@/hooks/use-ledger';
import { formatMoney } from '@/lib/dashboard-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FinancialTable } from '@/components/ui/financial-table';
import { PageHeader } from './page-header';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Tab = 'receivables' | 'payables';
const ALL = 'all';
const AGING_BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'] as const;

const AGING_LABEL_KEYS: Record<(typeof AGING_BUCKETS)[number], string> = {
  current: 'agingCurrent',
  '1-30': 'aging1to30',
  '31-60': 'aging31to60',
  '61-90': 'aging61to90',
  '90+': 'aging90Plus',
};

export function LedgerPage() {
  const { t, format } = useLanguage();
  const dash = t.dashboard as Record<string, string>;
  const ledger = t.ledger as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const empty = t.empty as Record<string, string>;
  const { data, loading, error } = useLedger();
  const [tab, setTab] = useState<Tab>('receivables');
  const [agingFilter, setAgingFilter] = useState<string>(ALL);
  const [counterpartyQuery, setCounterpartyQuery] = useState('');

  const allRows = useMemo(() => {
    if (!data) return [];
    return tab === 'receivables' ? data.receivables : data.payables;
  }, [data, tab]);

  const aging = useMemo(() => {
    if (!data) return [];
    return tab === 'receivables' ? data.arAging : data.apAging;
  }, [data, tab]);

  const filteredRows = useMemo(() => {
    const q = counterpartyQuery.trim().toLowerCase();
    return allRows.filter((row) => {
      if (agingFilter !== ALL && row.agingBucket !== agingFilter) return false;
      if (q && !row.counterparty.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRows, agingFilter, counterpartyQuery]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{dash.loading}</p>;
  }
  if (error) {
    return <p className="text-sm text-cash-negative">{error}</p>;
  }
  if (!data) return null;

  const agingLabel = (bucket: string) => {
    const key = AGING_LABEL_KEYS[bucket as (typeof AGING_BUCKETS)[number]];
    return key ? ledger[key] : bucket.toUpperCase();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={nav.ledger}
        subtitle={ledger.pageSubtitle}
        meta={format('dashboard.asOf', { date: data.asOfDate })}
      />

      <div className="flex gap-2">
        {(['receivables', 'payables'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setAgingFilter(ALL);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-primary/15 text-primary shadow-glow-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {ledger[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        {aging.map((b) => (
          <button
            key={b.bucket}
            type="button"
            onClick={() => setAgingFilter(agingFilter === b.bucket ? ALL : b.bucket)}
            className={cn(
              'rounded-xl border text-left transition-colors',
              agingFilter === b.bucket
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <Card className="border-0 bg-transparent shadow-none">
              <CardContent className="py-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {agingLabel(b.bucket)}
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums">
                  {formatMoney(data.currency, b.amount)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format('common.items', { count: String(b.count) })}
                </p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {ledger.filterCounterparty}
          <input
            type="search"
            value={counterpartyQuery}
            onChange={(e) => setCounterpartyQuery(e.target.value)}
            placeholder={ledger.filterCounterpartyPlaceholder}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {ledger.filterAging}
          <select
            value={agingFilter}
            onChange={(e) => setAgingFilter(e.target.value)}
            className="min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value={ALL}>{ledger.filterAllAging}</option>
            {AGING_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {agingLabel(bucket)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tab === 'receivables' ? ledger.arTitle : ledger.apTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialTable
            rows={filteredRows}
            rowKey={(r) => r.id}
            empty={
              allRows.length === 0 ? (
                <EmptyState
                  title={empty.ledgerTitle}
                  description={empty.ledgerHint}
                  actionLabel={nav.uploads}
                  actionHref="/uploads"
                />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {ledger.noFilterResults}
                </p>
              )
            }
            columns={[
              { key: 'party', header: ledger.counterparty, render: (r) => r.counterparty },
              {
                key: 'doc',
                header: ledger.document,
                muted: true,
                render: (r) => r.documentNumber,
              },
              {
                key: 'due',
                header: ledger.dueDate,
                muted: true,
                render: (r) => r.dueDate,
              },
              {
                key: 'amount',
                header: ledger.amount,
                align: 'right',
                mono: true,
                render: (r) => formatMoney(data.currency, r.outstandingAmount),
              },
              {
                key: 'aging',
                header: ledger.aging,
                render: (r) => agingLabel(r.agingBucket),
              },
              {
                key: 'status',
                header: ledger.status,
                render: (r) => (
                  <Badge variant={r.status === 'overdue' ? 'cash-negative' : 'cash-positive'}>
                    {r.status === 'overdue' ? dash.overdue : dash.open}
                  </Badge>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
