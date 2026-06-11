'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { WeeklyForecastLine } from '@/lib/dashboard-types';
import { CHART_COLORS, ChartTooltip, chartAxisStyle } from './chart-theme';

export function ForecastAreaChart({
  lines,
  currency,
  labels,
}: {
  lines: WeeklyForecastLine[];
  currency: string;
  labels: { closing: string; weekPrefix: string };
}) {
  const { closing: closingLabel, weekPrefix } = labels;
  const data = lines.map((l) => ({
    week: `${weekPrefix}${l.weekIndex}`,
    closing: l.closingCash,
    inflows: l.forecastInflows,
    outflows: l.forecastOutflows,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
        <Area
          type="monotone"
          dataKey="closing"
          name={closingLabel}
          stroke={CHART_COLORS.primary}
          fill={CHART_COLORS.primary}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
