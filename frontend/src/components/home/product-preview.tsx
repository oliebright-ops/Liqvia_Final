'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@liqvia2/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS, ChartTooltip, chartAxisStyle } from '@/components/charts/chart-theme';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const CURRENCY = 'USD';
const CHART_HEIGHT = 220;

/**
 * Same first-paint deferral as useChartMountReady, plus a timeout fallback —
 * a marketing page can be opened in a background tab (new-tab link, prerender),
 * where requestAnimationFrame never fires because the tab stays hidden, which
 * would otherwise leave the chart stuck on its placeholder indefinitely.
 */
export function useMountReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let settled = false;
    const mark = () => {
      if (!settled) {
        settled = true;
        setReady(true);
      }
    };
    const raf = requestAnimationFrame(mark);
    const timer = setTimeout(mark, 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);
  return ready;
}
const WEEK_COUNT = 13;

// Decorative demo curve — starts at the KPI row's "Current Cash" figure and
// drifts down toward the 18-week runway, with the usual payroll/AR noise.
export const EXPECTED = [
  247800, 241000, 252000, 238000, 226000, 233000, 214000, 205000, 217000, 201000, 190000, 199000,
  182000, 171000,
];

export type Scenario = 'expected' | 'optimistic' | 'conservative';

const SCENARIOS: Scenario[] = ['expected', 'optimistic', 'conservative'];

const OBLIGATIONS = [
  { key: 'payroll', amount: 42000, due: 'Jul 25', priority: 'critical', status: 'dueSoon' },
  { key: 'gst', amount: 18400, due: 'Aug 1', priority: 'tax', status: 'scheduled' },
  { key: 'rent', amount: 9200, due: 'Jul 21', priority: 'critical', status: 'dueSoon' },
  { key: 'suppliers', amount: 8200, due: 'Jul 28', priority: 'flexible', status: 'scheduled' },
  { key: 'loan', amount: 6100, due: 'Jul 30', priority: 'critical', status: 'funded' },
] as const;

const STATUS_BADGE: Record<(typeof OBLIGATIONS)[number]['status'], 'warning' | 'muted' | 'success'> = {
  dueSoon: 'warning',
  scheduled: 'muted',
  funded: 'success',
};

export function buildChartData(scenario: Scenario, weekLabel: (i: number) => string) {
  return EXPECTED.map((expected, i) => {
    const t = i / (EXPECTED.length - 1);
    const optimistic = expected * (1 + t * 0.18);
    const conservative = expected * (1 - t * 0.16);
    const closing = scenario === 'optimistic' ? optimistic : scenario === 'conservative' ? conservative : expected;
    const band = 0.02 + t * 0.13;
    return {
      week: weekLabel(i),
      closing: Math.round(closing),
      band: [Math.round(closing * (1 - band)), Math.round(closing * (1 + band))],
    };
  });
}

export function ProductPreview() {
  const t = useTranslations();
  const p = 'home.landing.hero.preview';
  const [scenario, setScenario] = useState<Scenario>('expected');

  const weekLabel = (i: number) => (i === 0 ? t(`${p}.chart.today`) : `${t(`${p}.chart.weekPrefix`)}${i}`);
  const data = useMemo(() => buildChartData(scenario, weekLabel), [scenario, t]);
  const ready = useMountReady();
  const todayLabel = t(`${p}.chart.today`);
  const lastWeekLabel = `${t(`${p}.chart.weekPrefix`)}${WEEK_COUNT}`;

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-[0_28px_70px_rgba(0,0,0,0.35)] sm:p-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={t(`${p}.kpi.currentCash`)} value={formatCurrency(247800, CURRENCY)} primary />
        <KpiCard
          label={t(`${p}.kpi.cashRunway`)}
          value={t(`${p}.kpi.cashRunwayValue`)}
          subtitle={t(`${p}.kpi.cashRunwaySubtitle`)}
        />
        <KpiCard
          label={t(`${p}.kpi.liquidityHealth`)}
          value={t(`${p}.kpi.liquidityHealthy`)}
          badge={<Badge variant="success">{t(`${p}.kpi.liquidityOnTrack`)}</Badge>}
        />
        <KpiCard label={t(`${p}.kpi.weeklyBurn`)} value={formatCurrency(12300, CURRENCY)} negative />
      </div>

      {/* Main panel + sidebar */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px] xl:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 p-4 pb-1.5">
            <CardTitle className="text-sm">{t(`${p}.chart.title`)}</CardTitle>
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-semibold">
              {SCENARIOS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScenario(key)}
                  aria-pressed={scenario === key}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 transition-colors',
                    scenario === key
                      ? 'bg-primary text-primary-foreground shadow-glow-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(`${p}.scenario.${key}`)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {!ready ? (
              <div style={{ width: '100%', height: CHART_HEIGHT }} />
            ) : (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" {...chartAxisStyle} />
                  <YAxis {...chartAxisStyle} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <ChartTooltip
                        active={active}
                        label={String(label)}
                        currency={CURRENCY}
                        payload={payload
                          ?.filter((entry) => entry.dataKey === 'closing')
                          .map((entry) => ({
                            name: t(`${p}.chart.closingCash`),
                            value: Number(entry.value),
                            color: CHART_COLORS.primary,
                          }))}
                      />
                    )}
                  />
                  <ReferenceLine x={todayLabel} stroke={CHART_COLORS.grid} strokeDasharray="3 3">
                    <Label value={todayLabel} position="insideTopLeft" fill={CHART_COLORS.muted} fontSize={10} />
                  </ReferenceLine>
                  <ReferenceLine x={lastWeekLabel} stroke={CHART_COLORS.grid} strokeDasharray="3 3">
                    <Label
                      value={t(`${p}.chart.week13`)}
                      position="insideTopRight"
                      fill={CHART_COLORS.muted}
                      fontSize={10}
                    />
                  </ReferenceLine>
                  <Area
                    dataKey="band"
                    name={t(`${p}.chart.confidenceRange`)}
                    stroke="none"
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.12}
                    isAnimationActive={false}
                    tooltipType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="closing"
                    name={t(`${p}.chart.closingCash`)}
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1.5">
            <CardTitle className="text-sm">{t(`${p}.obligations.title`)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {OBLIGATIONS.map((o) => (
              <div key={o.key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t(`${p}.obligations.names.${o.key}`)}</p>
                  <Badge variant={STATUS_BADGE[o.status]}>{t(`${p}.obligations.status.${o.status}`)}</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(o.amount, CURRENCY)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`${p}.obligations.due`)} {o.due}
                  </p>
                </div>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`forecast.riskInsights.priority.${o.priority}`)} {t(`${p}.obligations.prioritySuffix`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
