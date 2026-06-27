import type { ScenarioVariables } from '@liqvia2/shared';
import { DEFAULT_SCENARIO_VARIABLES } from '@liqvia2/shared';

export type { ScenarioVariables };

export type ScenarioPreset = {
  id: string;
  vars: ScenarioVariables;
};

function vars(overrides: Partial<ScenarioVariables>): ScenarioVariables {
  return { ...DEFAULT_SCENARIO_VARIABLES, ...overrides };
}

export const MARKETING_SCENARIO_PRESET_IDS = [
  'revenue_drop_20',
  'hire_three',
  'payments_slow_15',
] as const;

export type MarketingScenarioPresetId = (typeof MARKETING_SCENARIO_PRESET_IDS)[number];

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: 'baseline_clear', vars: vars({}) },
  { id: 'revenue_drop_20', vars: vars({ revenueDeclinePercent: 20 }) },
  { id: 'revenue_growth_10', vars: vars({ revenueGrowthPercent: 10 }) },
  { id: 'payments_slow_15', vars: vars({ receivableDelayDays: 15 }) },
  { id: 'overdue_ar_stress', vars: vars({ receivableDelayDays: 30 }) },
  { id: 'double_shock', vars: vars({ revenueDeclinePercent: 20, receivableDelayDays: 15 }) },
  { id: 'seasonal_slowdown', vars: vars({ revenueDeclinePercent: 10, receivableDelayDays: 7 }) },
  { id: 'hire_three', vars: vars({ payrollIncreasePercent: 12 }) },
  { id: 'hiring_spike', vars: vars({ payrollIncreasePercent: 20 }) },
  { id: 'cost_inflation', vars: vars({ payrollIncreasePercent: 5, expenseGrowthPercent: 10 }) },
  { id: 'supplier_crunch', vars: vars({ expenseGrowthPercent: 25 }) },
  { id: 'defer_ap_30', vars: vars({ payableDelayDays: 30 }) },
  { id: 'extend_runway_45', vars: vars({ payableDelayDays: 45 }) },
  { id: 'tax_hike_15', vars: vars({ taxIncreasePercent: 15 }) },
  {
    id: 'capex_75k_w4',
    vars: vars({ oneOffOutflowAmount: 75_000, oneOffOutflowWeek: 4 }),
  },
  {
    id: 'funding_100k_w2',
    vars: vars({ oneOffInflowAmount: 100_000, oneOffInflowWeek: 2 }),
  },
  {
    id: 'new_office_fitout',
    vars: vars({
      expenseGrowthPercent: 15,
      oneOffOutflowAmount: 120_000,
      oneOffOutflowWeek: 3,
    }),
  },
  {
    id: 'optimistic_combo',
    vars: vars({
      revenueGrowthPercent: 8,
      receivableDelayDays: 0,
      payableDelayDays: 14,
      oneOffInflowAmount: 50_000,
      oneOffInflowWeek: 1,
    }),
  },
  {
    id: 'combined_pessimistic',
    vars: vars({
      revenueDeclinePercent: 15,
      payrollIncreasePercent: 8,
      receivableDelayDays: 10,
      expenseGrowthPercent: 12,
      taxIncreasePercent: 10,
    }),
  },
  {
    id: 'worst_case_full',
    vars: vars({
      revenueDeclinePercent: 25,
      payrollIncreasePercent: 10,
      receivableDelayDays: 21,
      expenseGrowthPercent: 20,
      taxIncreasePercent: 15,
      oneOffOutflowAmount: 50_000,
      oneOffOutflowWeek: 6,
    }),
  },
];

export const MARKETING_SCENARIO_PRESETS = SCENARIO_PRESETS.filter((preset) =>
  (MARKETING_SCENARIO_PRESET_IDS as readonly string[]).includes(preset.id),
);

export const SCENARIO_PRESET_CATEGORIES: { id: string; presetIds: string[] }[] = [
  {
    id: 'revenue',
    presetIds: [
      'baseline_clear',
      'revenue_drop_20',
      'revenue_growth_10',
      'payments_slow_15',
      'overdue_ar_stress',
      'double_shock',
      'seasonal_slowdown',
    ],
  },
  {
    id: 'payroll',
    presetIds: ['hire_three', 'hiring_spike', 'cost_inflation'],
  },
  {
    id: 'costs',
    presetIds: ['supplier_crunch', 'defer_ap_30', 'extend_runway_45', 'tax_hike_15'],
  },
  {
    id: 'oneoff',
    presetIds: ['capex_75k_w4', 'funding_100k_w2', 'new_office_fitout'],
  },
  {
    id: 'combined',
    presetIds: ['optimistic_combo', 'combined_pessimistic', 'worst_case_full'],
  },
];

const presetById = new Map(SCENARIO_PRESETS.map((p) => [p.id, p]));

export function getScenarioPreset(id: string): ScenarioPreset | undefined {
  return presetById.get(id);
}

export const DEFAULT_SCENARIO_VARS = DEFAULT_SCENARIO_VARIABLES;
