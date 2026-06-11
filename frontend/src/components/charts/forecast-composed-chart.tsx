'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WeeklyForecastLine } from '@/lib/dashboard-types';
import { CHART_COLORS, ChartTooltip, chartAxisStyle } from './chart-theme';

export function ForecastComposedChart({
  lines,
  currency,
  labels,
  height = 300,
}: {
  lines: WeeklyForecastLine[];
  currency: string;
  labels: {
    closing: string;
    inflows: string;
    outflows: string;
    weekPrefix: string;
  };
  height?: number;
}) {
  const data = lines.map((l) => ({
    week: `${labels.weekPrefix}${l.weekIndex}`,
    closing: l.closingCash,
    inflows: l.forecastInflows,
    outflows: -Math.abs(l.forecastOutflows),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" {...chartAxisStyle} />
        <YAxis
          {...chartAxisStyle}
          width={44}
          tickFormatter={(v) => `${(Math.abs(v) / 1000).toFixed(0)}k`}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              label={String(label)}
              currency={currency}
              payload={payload?.map((p) => ({
                name: String(p.name),
                value: Math.abs(Number(p.value)),
                color: String(p.color),
              }))}
            />
          )}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: CHART_COLORS.muted, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          dataKey="inflows"
          name={labels.inflows}
          fill={CHART_COLORS.inflow}
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="outflows"
          name={labels.outflows}
          fill={CHART_COLORS.outflow}
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Line
          type="monotone"
          dataKey="closing"
          name={labels.closing}
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
