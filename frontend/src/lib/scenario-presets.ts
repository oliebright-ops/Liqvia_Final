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
];

export const DEFAULT_SCENARIO_VARS: ScenarioVariables = {
  revenueDeclinePercent: 10,
  payrollIncreasePercent: 5,
  receivableDelayDays: 14,
  expenseGrowthPercent: 5,
};
