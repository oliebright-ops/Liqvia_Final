'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { useDashboard } from '@/hooks/use-dashboard';
import { ScenarioComparison, formatMoney } from '@/lib/dashboard-types';
import { ScenarioProjectionChart } from '@/components/charts/scenario-projection-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from './page-header';
import { useLanguage } from '@/lib/i18n';

const SLIDERS = [
  { key: 'revenueDeclinePercent', labelKey: 'revenueDecline', max: 100 },
  { key: 'payrollIncreasePercent', labelKey: 'payrollIncrease', max: 100 },
  { key: 'receivableDelayDays', labelKey: 'receivableDelay', max: 60 },
  { key: 'expenseGrowthPercent', labelKey: 'expenseGrowth', max: 100 },
] as const;

export function ScenariosPage() {
  const { t } = useLanguage();
  const chart = t.chart as Record<string, string>;
  const scenarioT = t.scenario as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const dash = t.dashboard as Record<string, string>;
  const { data } = useDashboard();
  const [vars, setVars] = useState({
    revenueDeclinePercent: 10,
    payrollIncreasePercent: 5,
    receivableDelayDays: 14,
    expenseGrowthPercent: 5,
  });
  const [result, setResult] = useState<ScenarioComparison | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) {
    return <p className="text-sm text-muted-foreground">{dash.loading}</p>;
  }

  async function run() {
    if (!data) return;
    setRunning(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string }>('/scenarios', {
        companyId: data.companyId,
        name: `Scenario ${new Date().toISOString().slice(0, 16)}`,
        variables: vars,
      });
      const comparison = await apiPost<ScenarioComparison>(
        `/scenarios/${created.id}/recalculate`,
        {},
      );
      setResult(comparison);
    } catch (e) {
      setError(e instanceof Error ? e.message : scenarioT.failed);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={nav.scenarios} subtitle={scenarioT.subtitle} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{scenarioT.title}</CardTitle>
            <CardDescription>{scenarioT.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {SLIDERS.map((s) => (
                <label key={s.key} className="block">
                  <span className="flex justify-between text-xs font-medium text-muted-foreground">
                    {scenarioT[s.labelKey]}
                    <span className="font-mono tabular-nums text-foreground">
                      {vars[s.key as keyof typeof vars]}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={s.max}
                    value={vars[s.key as keyof typeof vars]}
                    onChange={(e) =>
                      setVars((v) => ({ ...v, [s.key]: Number(e.target.value) }))
                    }
                    className="mt-2 w-full accent-primary"
                  />
                </label>
              ))}
            </div>
            <Button onClick={() => void run()} disabled={running}>
              {running ? scenarioT.running : scenarioT.run}
            </Button>
            {error && <p className="text-xs text-cash-negative">{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>{scenarioT.resultTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label={scenarioT.baselineW13}
                  value={formatMoney(data.currency, result.baseline.week13ClosingCash)}
                />
                <Stat
                  label={scenarioT.scenarioW13}
                  value={formatMoney(data.currency, result.scenario.week13ClosingCash)}
                />
                <Stat
                  label={scenarioT.deltaW13}
                  value={formatMoney(data.currency, result.delta.week13ClosingCash)}
                  negative={(result.delta.week13ClosingCash ?? 0) < 0}
                />
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      {result?.baseline?.lines && result?.scenario?.lines && (
        <Card>
          <CardHeader>
            <CardTitle>{scenarioT.chartTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScenarioProjectionChart
              baseline={result.baseline.lines}
              scenario={result.scenario.lines}
              currency={data.currency}
              labels={{
                baseline: chart.baseline,
                scenario: chart.scenario,
                weekPrefix: chart.weekPrefix,
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
          negative ? 'text-cash-negative' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
