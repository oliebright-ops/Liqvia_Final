'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WeeklyForecastLine } from '@/lib/dashboard-types';
import { CHART_COLORS, ChartTooltip, chartAxisStyle } from './chart-theme';

export function ScenarioProjectionChart({
  baseline,
  scenario,
  currency,
  labels,
}: {
  baseline: WeeklyForecastLine[];
  scenario: WeeklyForecastLine[];
  currency: string;
  labels: { baseline: string; scenario: string; weekPrefix: string };
}) {
  const data = baseline.map((b, i) => ({
    week: `${labels.weekPrefix}${b.weekIndex}`,
    baseline: b.closingCash,
    scenario: scenario[i]?.closingCash ?? b.closingCash,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" {...chartAxisStyle} />
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
        <Line
          type="monotone"
          dataKey="baseline"
          name={labels.baseline}
          stroke={CHART_COLORS.muted}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="scenario"
          name={labels.scenario}
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
