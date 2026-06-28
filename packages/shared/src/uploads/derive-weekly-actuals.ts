import { toIsoWeek } from '../reporting-period';
import { getPastWeekPeriods, type RollingBudgetCategory, type WeeklyAmountRow } from '../rolling-budget';

export type BankMovementForActuals = {
  movementDate: string;
  amount: number;
  isInflow: boolean;
  description?: string | null;
};

const PAYROLL_KEYWORDS =
  /payroll|salary|salaries|wage|wages|compensation|superannuation|pension|benefits/i;

function inferOutflowCategory(description?: string | null): RollingBudgetCategory {
  if (PAYROLL_KEYWORDS.test(description ?? '')) return 'payroll';
  return 'expenses';
}

/** Build weekly actual rows from bank movements when no AR/AP or weekly actuals upload exists. */
export function deriveWeeklyActualsFromBankMovements(
  movements: BankMovementForActuals[],
  asOfDate: string,
): WeeklyAmountRow[] {
  const allowedPeriods = new Set(getPastWeekPeriods(asOfDate));
  const totals = new Map<string, number>();

  for (const movement of movements) {
    const date = movement.movementDate.slice(0, 10);
    const period = toIsoWeek(date);
    if (!allowedPeriods.has(period)) continue;

    const category: RollingBudgetCategory = movement.isInflow
      ? 'revenue'
      : inferOutflowCategory(movement.description);
    const key = `${period}|${category}`;
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(movement.amount));
  }

  return [...totals.entries()].map(([key, amount]) => {
    const [period, category] = key.split('|') as [string, RollingBudgetCategory];
    return { period, category, amount };
  });
}
