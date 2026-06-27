/** Shared SME scenario presets — used on marketing page and Scenarios module. */
export type ScenarioVariables = {
  revenueDeclinePercent: number;
  payrollIncreasePercent: number;
  receivableDelayDays: number;
  expenseGrowthPercent: number;
};

export type ScenarioPreset = {
  id: string;
  vars: ScenarioVariables;
};

export const MARKETING_SCENARIO_PRESET_IDS = [
  'revenue_drop_20',
  'hire_three',
  'payments_slow_15',
] as const;

export type MarketingScenarioPresetId = (typeof MARKETING_SCENARIO_PRESET_IDS)[number];

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'revenue_drop_20',
    vars: {
      revenueDeclinePercent: 20,
      payrollIncreasePercent: 0,
      receivableDelayDays: 0,
      expenseGrowthPercent: 0,
    },
  },
  {
    id: 'hire_three',
    vars: {
      revenueDeclinePercent: 0,
      payrollIncreasePercent: 12,
      receivableDelayDays: 0,
      expenseGrowthPercent: 0,
    },
  },
  {
    id: 'payments_slow_15',
    vars: {
      revenueDeclinePercent: 0,
      payrollIncreasePercent: 0,
      receivableDelayDays: 15,
      expenseGrowthPercent: 0,
    },
  },
  {
    id: 'overdue_ar_stress',
    vars: {
      revenueDeclinePercent: 0,
      payrollIncreasePercent: 0,
      receivableDelayDays: 30,
      expenseGrowthPercent: 0,
    },
  },
];

/** Presets shown on the marketing homepage (subset of SCENARIO_PRESETS). */
export const MARKETING_SCENARIO_PRESETS = SCENARIO_PRESETS.filter((preset) =>
  (MARKETING_SCENARIO_PRESET_IDS as readonly string[]).includes(preset.id),
);

export const DEFAULT_SCENARIO_VARS: ScenarioVariables = {
  revenueDeclinePercent: 10,
  payrollIncreasePercent: 5,
  receivableDelayDays: 14,
  expenseGrowthPercent: 5,
};
