'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDashboard } from '@/hooks/use-dashboard';
import { ScenarioComparison, formatMoney } from '@/lib/dashboard-types';
import {
  DEFAULT_SCENARIO_VARS,
  SCENARIO_PRESET_CATEGORIES,
  getScenarioPreset,
} from '@/lib/scenario-presets';
import { ScenarioParamControl } from '@/components/treasury/scenario-param-control';
import { HeadcountPayrollCalculator } from '@/components/treasury/headcount-payroll-calculator';
import { ScenarioMechanicsPanel } from '@/components/treasury/scenario-mechanics-panel';
import {
  SavedScenarioSummary,
  SavedScenariosPanel,
} from '@/components/treasury/saved-scenarios-panel';
import { ScenarioProjectionChart } from '@/components/charts/scenario-projection-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from './page-header';
import { useLanguage, useTranslations } from '@/lib/i18n';
import { SCENARIO_PARAM_GROUPS, SCENARIO_PARAM_SPECS } from '@liqvia2/shared';

const PREVIEW_DEBOUNCE_MS = 700;

export function ScenariosPage() {
  const { can } = useAuth();
  const { t } = useLanguage();
  const translate = useTranslations();
  const chart = t.chart as Record<string, string>;
  const scenarioT = t.scenario as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const dash = t.dashboard as Record<string, string>;
  const { data } = useDashboard();
  const [vars, setVars] = useState(DEFAULT_SCENARIO_VARS);
  const [activePreset, setActivePreset] = useState<string | null>('baseline_clear');
  const [headcountHires, setHeadcountHires] = useState(3);
  const [headcountSalary, setHeadcountSalary] = useState(45000);
  const [headcountTeamSize, setHeadcountTeamSize] = useState(25);
  const [scenarioName, setScenarioName] = useState('');
  const [result, setResult] = useState<ScenarioComparison | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioSummary[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSavedId, setLoadingSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewSeq = useRef(0);

  const refreshSaved = useCallback(async () => {
    if (!can('scenarios:read')) return;
    try {
      const list = await apiGet<SavedScenarioSummary[]>('/scenarios');
      setSavedScenarios(list);
    } catch {
      /* list is optional UX */
    }
  }, [can]);

  const runPreview = useCallback(
    async (variables: typeof vars) => {
      if (!can('scenarios:read')) return;
      const seq = ++previewSeq.current;
      setPreviewing(true);
      setError(null);
      try {
        const comparison = await apiPost<ScenarioComparison>('/scenarios/preview', { variables });
        if (seq === previewSeq.current) setResult(comparison);
      } catch (e) {
        if (seq === previewSeq.current) {
          setError(e instanceof Error ? e.message : scenarioT.failed);
        }
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    },
    [can, scenarioT.failed],
  );

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!can('scenarios:read')) return;
    const timer = setTimeout(() => {
      void runPreview(vars);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [vars, can, runPreview]);

  const pinnedScenarios = savedScenarios.filter((s) => pinnedIds.includes(s.id));

  if (!data) {
    return <p className="text-sm text-muted-foreground">{dash.loading}</p>;
  }

  async function saveScenario() {
    if (!can('scenarios:write')) return;
    const name =
      scenarioName.trim() ||
      translate('scenario.defaultName', { date: new Date().toLocaleString() });
    setSaving(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string }>('/scenarios', { name, variables: vars });
      const comparison = await apiPost<ScenarioComparison>(
        `/scenarios/${created.id}/recalculate`,
        {},
      );
      setResult(comparison);
      setScenarioName('');
      await refreshSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : scenarioT.failed);
    } finally {
      setSaving(false);
    }
  }

  function applyPreset(presetId: string) {
    const preset = getScenarioPreset(presetId);
    if (!preset) return;
    setVars(preset.vars);
    setActivePreset(presetId);
    if (presetId === 'hire_three' || presetId === 'hiring_spike') {
      setHeadcountHires(presetId === 'hire_three' ? 3 : 5);
      setHeadcountSalary(45000);
      setHeadcountTeamSize(25);
    }
  }

  function loadSavedScenario(scenario: SavedScenarioSummary) {
    setLoadingSavedId(scenario.id);
    setVars(scenario.variables);
    setActivePreset(null);
    setScenarioName(scenario.name);
    setLoadingSavedId(null);
  }

  function togglePin(id: string) {
    setPinnedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={nav.scenarios} subtitle={scenarioT.subtitle} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{scenarioT.title}</CardTitle>
              <CardDescription>{scenarioT.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {SCENARIO_PRESET_CATEGORIES.map((category) => (
                <div key={category.id}>
                  <p className="text-xs font-medium text-muted-foreground">
                    {translate(`scenario.categories.${category.id}`)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {category.presetIds.map((presetId) => (
                      <button
                        key={presetId}
                        type="button"
                        onClick={() => applyPreset(presetId)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          activePreset === presetId
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <span className="block font-medium">
                          {translate(`scenario.presets.${presetId}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {scenarioT.presetSectionHint}
              </p>

              <HeadcountPayrollCalculator
                data={data}
                hires={headcountHires}
                annualSalary={headcountSalary}
                teamSize={headcountTeamSize}
                onHiresChange={setHeadcountHires}
                onSalaryChange={setHeadcountSalary}
                onTeamSizeChange={setHeadcountTeamSize}
                onApplyPercent={(percent) => {
                  setActivePreset(null);
                  setVars((v) => ({ ...v, payrollIncreasePercent: percent }));
                }}
              />

              <div className="space-y-5">
                {SCENARIO_PARAM_GROUPS.map((group) => {
                  const specs = SCENARIO_PARAM_SPECS.filter((s) => s.group === group);
                  return (
                    <div key={group}>
                      <p className="text-xs font-semibold text-foreground">
                        {translate(`scenario.paramGroups.${group}`)}
                      </p>
                      <div className="mt-3 grid gap-5 sm:grid-cols-2">
                        {specs.map((spec) => (
                          <ScenarioParamControl
                            key={spec.key}
                            spec={spec}
                            value={vars[spec.key]}
                            label={scenarioT[spec.labelKey] ?? spec.labelKey}
                            onChange={(next) => {
                              setActivePreset(null);
                              setVars((v) => ({ ...v, [spec.key]: next }));
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {previewing ? scenarioT.previewing : scenarioT.previewHint}
              </p>

              {can('scenarios:write') ? (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block min-w-[200px] flex-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {scenarioT.nameLabel}
                    </span>
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder={scenarioT.namePlaceholder}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <Button onClick={() => void saveScenario()} disabled={saving || previewing}>
                    {saving ? scenarioT.saving : scenarioT.save}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{scenarioT.readOnly}</p>
              )}
              {error && <p className="text-xs text-cash-negative">{error}</p>}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>{scenarioT.resultTitle}</CardTitle>
                <CardDescription>{scenarioT.resultHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  <Stat
                    label={scenarioT.scenarioRunway}
                    value={
                      result.scenario.runwayWeeks !== null
                        ? `${result.scenario.runwayWeeks} ${translate('dashboard.weeks')}`
                        : '—'
                    }
                    sub={
                      result.delta.runwayWeeks !== null
                        ? translate('scenario.runwayDelta', {
                            delta: String(result.delta.runwayWeeks),
                          })
                        : undefined
                    }
                    negative={(result.delta.runwayWeeks ?? 0) < 0}
                  />
                </dl>
              </CardContent>
            </Card>
          )}

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

          {(pinnedScenarios.length > 0 || result) && (
            <Card>
              <CardHeader>
                <CardTitle>{scenarioT.compareTitle}</CardTitle>
                <CardDescription>{scenarioT.compareHint}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">{scenarioT.compareColScenario}</th>
                      <th className="pb-2 pr-3 font-medium">{scenarioT.scenarioW13}</th>
                      <th className="pb-2 font-medium">{scenarioT.deltaW13}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result && (
                      <tr className="border-b border-border/60">
                        <td className="py-2 pr-3">{scenarioT.compareCurrent}</td>
                        <td className="py-2 pr-3 font-mono tabular-nums">
                          {formatMoney(data.currency, result.scenario.week13ClosingCash)}
                        </td>
                        <td
                          className={`py-2 font-mono tabular-nums ${
                            (result.delta.week13ClosingCash ?? 0) < 0
                              ? 'text-cash-negative'
                              : 'text-foreground'
                          }`}
                        >
                          {formatMoney(data.currency, result.delta.week13ClosingCash)}
                        </td>
                      </tr>
                    )}
                    {pinnedScenarios.map((s) => (
                      <tr key={s.id} className="border-b border-border/60">
                        <td className="py-2 pr-3">{s.name}</td>
                        <td className="py-2 pr-3 font-mono tabular-nums">
                          {formatMoney(data.currency, s.week13ClosingCash)}
                        </td>
                        <td
                          className={`py-2 font-mono tabular-nums ${
                            (s.deltaWeek13ClosingCash ?? 0) < 0
                              ? 'text-cash-negative'
                              : 'text-foreground'
                          }`}
                        >
                          {formatMoney(data.currency, s.deltaWeek13ClosingCash)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ScenarioMechanicsPanel />
          {can('scenarios:read') && (
            <SavedScenariosPanel
              scenarios={savedScenarios}
              currency={data.currency}
              pinnedIds={pinnedIds}
              loadingId={loadingSavedId}
              onLoad={loadSavedScenario}
              onTogglePin={togglePin}
              onRefresh={() => void refreshSaved()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
}) {
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
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
