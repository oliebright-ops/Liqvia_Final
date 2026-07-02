'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/dashboard-types';

/**
 * Recharts' ResponsiveContainer measures its parent element's width via
 * ResizeObserver as soon as it mounts. On a hard/first page load that initial
 * measurement can land before the browser has finished laying out the page
 * (fonts/CSS still settling), which leaves the chart permanently sized to 0
 * until something else forces an unrelated re-render/reflow — the exact
 * "chart is blank until I click something else" symptom (see F22).
 *
 * Deferring the chart's own mount by one animation frame lets layout settle
 * first, so ResponsiveContainer's first real measurement already sees the
 * correct width. Callers should keep reserving the chart's normal height
 * while `!ready`, so there's no layout shift once the chart appears.
 */
export function useChartMountReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return ready;
}

export const CHART_COLORS = {
  primary: 'hsl(221, 94%, 68%)',
  inflowOperational: 'hsl(221, 94%, 68%)',
  inflowAnomalous: 'hsl(221, 35%, 52%)',
  inflow: 'hsl(152, 60%, 45%)',
  outflow: 'hsl(0, 72%, 58%)',
  muted: 'hsl(215, 20%, 55%)',
  grid: 'hsl(222, 30%, 18%)',
  tooltipBg: 'hsl(222, 47%, 9%)',
};

export function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-border px-3 py-2 text-xs shadow-lg"
      style={{ background: CHART_COLORS.tooltipBg }}
    >
      {label && <p className="mb-1.5 font-medium text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="font-mono tabular-nums text-muted-foreground">
          <span style={{ color: p.color }}>{p.name}: </span>
          {formatMoney(currency, p.value)}
        </p>
      ))}
    </div>
  );
}

export const chartAxisStyle = {
  tick: { fill: CHART_COLORS.muted, fontSize: 11 },
  axisLine: { stroke: CHART_COLORS.grid, strokeWidth: 1 },
  tickLine: false as const,
};
