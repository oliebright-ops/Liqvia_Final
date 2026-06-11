'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { isExpenseCategory } from '@liqvia2/shared';
import { BudgetVarianceLine } from '@/lib/dashboard-types';
import { CHART_COLORS, ChartTooltip, chartAxisStyle } from './chart-theme';

const EXPENSE_CHART_COLORS = {
  budget: 'hsl(0, 72%, 58%)',
  actual: 'hsl(0, 72%, 78%)',
};

export function BudgetBarChart({
  lines,
  currency,
  labels,
}: {
  lines: BudgetVarianceLine[];
  currency: string;
  labels: { budget: string; actual: string };
}) {
  const data = lines.map((l) => ({
    label: `${l.period} · ${l.category.replace(/_/g, ' ')}`,
    category: l.category,
    budget: Math.abs(l.budgetAmount),
    actual: Math.abs(l.actualAmount),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          {...chartAxisStyle}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={56}
        />
        <YAxis {...chartAxisStyle} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              label={String(label)}
              currency={currency}
              payload={payload?.map((p) => ({
                name: String(p.name),
                value: Number(p.value),
                color: String(p.color),
              }))}
            />
          )}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART_COLORS.muted }} />
        <Bar dataKey="budget" name={labels.budget} radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={`budget-${entry.label}`}
              fill={
                isExpenseCategory(entry.category) ? EXPENSE_CHART_COLORS.budget : CHART_COLORS.muted
              }
            />
          ))}
        </Bar>
        <Bar dataKey="actual" name={labels.actual} radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={`actual-${entry.label}`}
              fill={
                isExpenseCategory(entry.category)
                  ? EXPENSE_CHART_COLORS.actual
                  : CHART_COLORS.primary
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
