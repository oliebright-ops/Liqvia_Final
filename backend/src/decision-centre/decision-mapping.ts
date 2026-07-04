import { ScenarioVariables } from '@liqvia2/shared';

export const DECISION_TYPES = [
  'hire',
  'buy_equipment',
  'withdraw_funds',
  'repay_debt',
  'expand',
  'custom',
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

const DEFAULT_PERCENT: Record<'hire' | 'expand', number> = {
  hire: 10,
  expand: 15,
};

const DEFAULT_AMOUNT: Record<'buy_equipment' | 'withdraw_funds' | 'repay_debt', number> = {
  buy_equipment: 10_000,
  withdraw_funds: 5_000,
  repay_debt: 10_000,
};

/**
 * Translates a "Can I...?" button into scenario variables for the existing
 * scenario/forecast engine — deliberately not a new forecasting model, per the
 * Phase 2 spec's "reuse existing calculations" rule. Returns null for 'custom',
 * which has no fixed shape and is answered from live data instead of a scenario.
 */
export function toScenarioVariables(
  type: DecisionType,
  amount?: number,
  percent?: number,
): Partial<ScenarioVariables> | null {
  switch (type) {
    case 'hire':
      return { payrollIncreasePercent: percent ?? DEFAULT_PERCENT.hire };
    case 'expand':
      return {
        revenueGrowthPercent: percent ?? DEFAULT_PERCENT.expand,
        payrollIncreasePercent: (percent ?? DEFAULT_PERCENT.expand) * 0.5,
      };
    case 'buy_equipment':
      return { oneOffOutflowAmount: amount ?? DEFAULT_AMOUNT.buy_equipment, oneOffOutflowWeek: 1 };
    case 'withdraw_funds':
      return { oneOffOutflowAmount: amount ?? DEFAULT_AMOUNT.withdraw_funds, oneOffOutflowWeek: 1 };
    case 'repay_debt':
      return { oneOffOutflowAmount: amount ?? DEFAULT_AMOUNT.repay_debt, oneOffOutflowWeek: 1 };
    case 'custom':
      return null;
  }
}

const DECISION_QUESTION: Record<DecisionType, (amount?: number, percent?: number) => string> = {
  hire: (_amount, percent) => `Can I afford to increase payroll by ${percent ?? DEFAULT_PERCENT.hire}% to hire?`,
  buy_equipment: (amount) => `Can I afford to buy equipment costing ${amount ?? DEFAULT_AMOUNT.buy_equipment}?`,
  withdraw_funds: (amount) => `Can I safely withdraw ${amount ?? DEFAULT_AMOUNT.withdraw_funds} from the business?`,
  repay_debt: (amount) => `Can I afford to repay ${amount ?? DEFAULT_AMOUNT.repay_debt} of debt now?`,
  expand: (_amount, percent) => `Can I afford to expand, growing revenue by ${percent ?? DEFAULT_PERCENT.expand}%?`,
  custom: () => '',
};

export function decisionQuestionText(type: DecisionType, amount?: number, percent?: number): string {
  return DECISION_QUESTION[type](amount, percent);
}
