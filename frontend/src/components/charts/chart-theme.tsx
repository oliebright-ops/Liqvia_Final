'use client';

import { formatMoney } from '@/lib/dashboard-types';

export const CHART_COLORS = {
  primary: 'hsl(221, 94%, 68%)',
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
