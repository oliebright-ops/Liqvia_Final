'use client';

import { useMemo, useState } from 'react';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatMoney } from '@/lib/dashboard-types';
import {
  budgetPeriodMonth,
  budgetPeriodQuarter,
  budgetPeriodYear,
  uniqueSorted,
} from '@/lib/budget-period';
import { BudgetBarChart } from '@/components/charts/budget-bar-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FinancialTable } from '@/components/ui/financial-table';
import { PageHeader } from './page-header';
import { useLanguage } from '@/lib/i18n';

const ALL = 'all';

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, ' ');
}

function formatMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

function formatQuarterLabel(
  quarterKey: string,
  format: (key: string, params?: Record<string, string>) => string,
): string {
  const match = quarterKey.match(/^(\d{4})-Q(\d)$/);
  if (!match) return quarterKey;
  return format('budget.quarterLabel', { quarter: match[2], year: match[1] });
}

export function BudgetPage() {
  const { t, format, locale } = useLanguage();
  const chart = t.chart as Record<string, string>;
  const dash = t.dashboard as Record<string, string>;
  const budget = t.budget as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const empty = t.empty as Record<string, string>;
  const { data, loading } = useDashboard();

  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [yearFilter, setYearFilter] = useState(ALL);
  const [quarterFilter, setQuarterFilter] = useState(ALL);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const [periodFilter, setPeriodFilter] = useState(ALL);

  const lines = data?.budgetVsActual.lines ?? [];
  const currency = data?.currency ?? 'USD';

  const categories = useMemo(
    () => [...new Set(lines.map((l) => l.category))].sort(),
    [lines],
  );
  const periods = useMemo(() => [...new Set(lines.map((l) => l.period))].sort(), [lines]);
  const years = useMemo(
    () => uniqueSorted(lines.map((l) => budgetPeriodYear(l.period))),
    [lines],
  );
  const quarters = useMemo(
    () => uniqueSorted(lines.map((l) => budgetPeriodQuarter(l.period))),
    [lines],
  );
  const months = useMemo(
    () => uniqueSorted(lines.map((l) => budgetPeriodMonth(l.period))),
    [lines],
  );

  const filteredLines = useMemo(
    () =>
      lines.filter((l) => {
        if (categoryFilter !== ALL && l.category !== categoryFilter) return false;
        if (yearFilter !== ALL && budgetPeriodYear(l.period) !== yearFilter) return false;
        if (quarterFilter !== ALL && budgetPeriodQuarter(l.period) !== quarterFilter) return false;
        if (monthFilter !== ALL && budgetPeriodMonth(l.period) !== monthFilter) return false;
        if (periodFilter !== ALL && l.period !== periodFilter) return false;
        return true;
      }),
    [lines, categoryFilter, yearFilter, quarterFilter, monthFilter, periodFilter],
  );

  const filteredTotals = useMemo(() => {
    const totalBudget = filteredLines.reduce((s, l) => s + l.budgetAmount, 0);
    const totalActual = filteredLines.reduce((s, l) => s + l.actualAmount, 0);
    const totalVariance = filteredLines.reduce((s, l) => s + l.varianceAmount, 0);
    return {
      totalBudget,
      totalActual,
      totalVariance,
    };
  }, [filteredLines]);

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">{dash.loading}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={nav.budget} subtitle={budget.pageSubtitle} />

      {lines.length === 0 ? (
        <EmptyState
          title={empty.budgetTitle}
          description={empty.budgetHint}
          actionLabel={nav.uploads}
          actionHref="/uploads"
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {budget.filterCategory}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value={ALL}>{budget.filterAllCategories}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatCategoryLabel(cat)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {budget.filterYear}
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value={ALL}>{budget.filterAllYears}</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {budget.filterQuarter}
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value={ALL}>{budget.filterAllQuarters}</option>
                {quarters.map((quarter) => (
                  <option key={quarter} value={quarter}>
                    {formatQuarterLabel(quarter, format)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {budget.filterMonth}
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value={ALL}>{budget.filterAllMonths}</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {budget.filterPeriod}
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value={ALL}>{budget.filterAllPeriods}</option>
                {periods.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="py-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {dash.budget}
                </p>
                <p className="mt-2 font-mono text-xl tabular-nums">
                  {formatMoney(currency, filteredTotals.totalBudget)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {dash.actual}
                </p>
                <p className="mt-2 font-mono text-xl tabular-nums">
                  {formatMoney(currency, filteredTotals.totalActual)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {dash.variance}
                </p>
                <p
                  className={`mt-2 font-mono text-xl tabular-nums ${
                    filteredTotals.totalVariance > 0
                      ? 'text-cash-positive'
                      : filteredTotals.totalVariance < 0
                        ? 'text-cash-negative'
                        : ''
                  }`}
                >
                  {formatMoney(currency, filteredTotals.totalVariance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{budget.chartTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">{budget.noFilterResults}</p>
              ) : (
                <BudgetBarChart
                  lines={filteredLines}
                  currency={currency}
                  labels={{ budget: chart.budget, actual: chart.actual }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dash.budgetTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialTable
                rows={filteredLines}
                rowKey={(r) => `${r.category}-${r.period}`}
                columns={[
                  {
                    key: 'category',
                    header: dash.category,
                    render: (r) => formatCategoryLabel(r.category),
                  },
                  {
                    key: 'period',
                    header: dash.period,
                    muted: true,
                    render: (r) => r.period,
                  },
                  {
                    key: 'budget',
                    header: dash.budget,
                    align: 'right',
                    mono: true,
                    render: (r) => formatMoney(currency, r.budgetAmount),
                  },
                  {
                    key: 'actual',
                    header: dash.actual,
                    align: 'right',
                    mono: true,
                    render: (r) => formatMoney(currency, r.actualAmount),
                  },
                  {
                    key: 'variance',
                    header: dash.variance,
                    align: 'right',
                    mono: true,
                    render: (r) => (
                      <span className="flex items-center justify-end gap-2">
                        <span
                          className={
                            r.varianceAmount > 0
                              ? 'text-cash-positive'
                              : r.varianceAmount < 0
                                ? 'text-cash-negative'
                                : ''
                          }
                        >
                          {formatMoney(currency, r.varianceAmount)}
                        </span>
                        {r.variancePercent !== null && (
                          <Badge
                            variant={
                              r.varianceAmount > 0
                                ? 'cash-positive'
                                : r.varianceAmount < 0
                                  ? 'cash-negative'
                                  : 'muted'
                            }
                          >
                            {r.variancePercent.toFixed(1)}%
                          </Badge>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
