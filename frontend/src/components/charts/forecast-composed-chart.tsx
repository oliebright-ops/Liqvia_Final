'use client';

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
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

function isAnomalousInflowWeek(
  weekIndex: number,
  inflows: number,
  openingCash: number,
  peerInflows: number[],
): boolean {
  if (weekIndex !== 1) return false;
  const peerMax = Math.max(...peerInflows, 0);
  const outlier = peerMax > 0 && inflows > peerMax * 2;
  const openingHeavy = openingCash > 0 && inflows >= openingCash * 0.4;
  return outlier || openingHeavy;
}

export function ForecastComposedChart({
  lines,
  currency,
  labels,
  height = 300,
  excludeW1 = false,
}: {
  lines: WeeklyForecastLine[];
  currency: string;
  labels: {
    closing: string;
    inflows: string;
    outflows: string;
    openingBalance: string;
    weekPrefix: string;
  };
  height?: number;
  excludeW1?: boolean;
}) {
  const visibleLines = useMemo(
    () => (excludeW1 ? lines.filter((l) => l.weekIndex !== 1) : lines),
    [excludeW1, lines],
  );

  const data = useMemo(() => {
    const peerInflows = lines.filter((l) => l.weekIndex !== 1).map((l) => l.forecastInflows);
    return visibleLines.map((l) => {
      const anomalous = isAnomalousInflowWeek(
        l.weekIndex,
        l.forecastInflows,
        l.openingCash,
        peerInflows,
      );
      return {
        week: `${labels.weekPrefix}${l.weekIndex}`,
        closing: l.closingCash,
        inflows: l.forecastInflows,
        outflows: -Math.abs(l.forecastOutflows),
        inflowType: anomalous ? 'anomalous' : 'operational',
      };
    });
  }, [visibleLines, lines, labels.weekPrefix]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
        barCategoryGap="18%"
        barGap={4}
      >
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
              payload={payload?.map((p) => {
                const row = p.payload as { inflowType?: string } | undefined;
                const name =
                  p.dataKey === 'inflows' && row?.inflowType === 'anomalous'
                    ? labels.openingBalance
                    : String(p.name);
                return {
                  name,
                  value: Math.abs(Number(p.value)),
                  color: String(p.color),
                };
              })}
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
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        >
          {data.map((entry) => (
            <Cell
              key={`inflow-${entry.week}`}
              fill={
                entry.inflowType === 'anomalous'
                  ? CHART_COLORS.inflowAnomalous
                  : CHART_COLORS.inflowOperational
              }
            />
          ))}
        </Bar>
        <Bar
          dataKey="outflows"
          name={labels.outflows}
          fill={CHART_COLORS.outflow}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
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
