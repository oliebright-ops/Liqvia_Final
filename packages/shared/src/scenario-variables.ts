import type { ScenarioVariables } from './treasury';

export type ScenarioParamGroup = 'revenue' | 'collections' | 'payables' | 'oneoff';

export type ScenarioParamSpec = {
  key: keyof ScenarioVariables;
  labelKey: string;
  min: number;
  max: number;
  /** Upper bound for typed input (may exceed slider max). */
  inputMax?: number;
  step: number;
  group: ScenarioParamGroup;
  showSlider?: boolean;
};

export const SCENARIO_PARAM_SPECS: ScenarioParamSpec[] = [
  {
    key: 'revenueDeclinePercent',
    labelKey: 'revenueDecline',
    min: 0,
    max: 100,
    step: 1,
    group: 'revenue',
  },
  {
    key: 'revenueGrowthPercent',
    labelKey: 'revenueGrowth',
    min: 0,
    max: 50,
    step: 1,
    group: 'revenue',
  },
  {
    key: 'receivableDelayDays',
    labelKey: 'receivableDelay',
    min: 0,
    max: 90,
    step: 1,
    group: 'collections',
  },
  {
    key: 'payrollIncreasePercent',
    labelKey: 'payrollIncrease',
    min: 0,
    max: 100,
    step: 1,
    group: 'payables',
  },
  {
    key: 'expenseGrowthPercent',
    labelKey: 'expenseGrowth',
    min: 0,
    max: 100,
    step: 1,
    group: 'payables',
  },
  {
    key: 'payableDelayDays',
    labelKey: 'payableDelay',
    min: 0,
    max: 90,
    step: 1,
    group: 'payables',
  },
  {
    key: 'taxIncreasePercent',
    labelKey: 'taxIncrease',
    min: 0,
    max: 100,
    step: 1,
    group: 'payables',
  },
  {
    key: 'oneOffInflowAmount',
    labelKey: 'oneOffInflow',
    min: 0,
    max: 500_000,
    inputMax: 10_000_000,
    step: 1000,
    group: 'oneoff',
    showSlider: false,
  },
  {
    key: 'oneOffInflowWeek',
    labelKey: 'oneOffInflowWeek',
    min: 1,
    max: 13,
    step: 1,
    group: 'oneoff',
  },
  {
    key: 'oneOffOutflowAmount',
    labelKey: 'oneOffOutflow',
    min: 0,
    max: 500_000,
    inputMax: 10_000_000,
    step: 1000,
    group: 'oneoff',
    showSlider: false,
  },
  {
    key: 'oneOffOutflowWeek',
    labelKey: 'oneOffOutflowWeek',
    min: 1,
    max: 13,
    step: 1,
    group: 'oneoff',
  },
];

export const SCENARIO_PARAM_GROUPS: ScenarioParamGroup[] = [
  'revenue',
  'collections',
  'payables',
  'oneoff',
];

export const DEFAULT_SCENARIO_VARIABLES: ScenarioVariables = {
  revenueDeclinePercent: 0,
  revenueGrowthPercent: 0,
  payrollIncreasePercent: 0,
  receivableDelayDays: 0,
  payableDelayDays: 0,
  expenseGrowthPercent: 0,
  taxIncreasePercent: 0,
  oneOffInflowAmount: 0,
  oneOffInflowWeek: 1,
  oneOffOutflowAmount: 0,
  oneOffOutflowWeek: 1,
};

/** Clamp and fill defaults for API / persisted scenarios (backward compatible). */
export function normalizeScenarioVariables(
  raw: Partial<ScenarioVariables> | null | undefined,
): ScenarioVariables {
  const base = { ...DEFAULT_SCENARIO_VARIABLES, ...raw };
  return {
    revenueDeclinePercent: clamp(base.revenueDeclinePercent, 0, 100),
    revenueGrowthPercent: clamp(base.revenueGrowthPercent, 0, 50),
    payrollIncreasePercent: clamp(base.payrollIncreasePercent, 0, 100),
    receivableDelayDays: clampInt(base.receivableDelayDays, 0, 90),
    payableDelayDays: clampInt(base.payableDelayDays, 0, 90),
    expenseGrowthPercent: clamp(base.expenseGrowthPercent, 0, 100),
    taxIncreasePercent: clamp(base.taxIncreasePercent, 0, 100),
    oneOffInflowAmount: clamp(base.oneOffInflowAmount, 0, 10_000_000),
    oneOffInflowWeek: clampInt(base.oneOffInflowWeek, 1, 13),
    oneOffOutflowAmount: clamp(base.oneOffOutflowAmount, 0, 10_000_000),
    oneOffOutflowWeek: clampInt(base.oneOffOutflowWeek, 1, 13),
  };
}

export function clampScenarioParam(key: keyof ScenarioVariables, value: number): number {
  const spec = SCENARIO_PARAM_SPECS.find((s) => s.key === key);
  if (!spec) return value;
  const max = spec.inputMax ?? spec.max;
  if (Number.isInteger(spec.step) && spec.step >= 1) {
    return clampInt(value, spec.min, max);
  }
  return clamp(value, spec.min, max);
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampInt(n: number, min: number, max: number): number {
  return Math.round(clamp(n, min, max));
}
