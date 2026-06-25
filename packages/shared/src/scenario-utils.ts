import { getPastWeekPeriods } from './rolling-budget';
import type { BudgetVarianceResult } from './kpi';

/** Payroll increase % from new hires vs team size or existing payroll base. */
export function payrollIncreaseFromHires(input: {
  hires: number;
  annualSalaryPerHire: number;
  currentTeamSize?: number;
  currentAnnualPayroll?: number;
}): number {
  if (input.hires <= 0) return 0;
  const addedPayroll = input.hires * input.annualSalaryPerHire;

  if (input.currentAnnualPayroll && input.currentAnnualPayroll > 0) {
    return clampPercent((addedPayroll / input.currentAnnualPayroll) * 100);
  }
  if (input.currentTeamSize && input.currentTeamSize > 0) {
    return clampPercent((input.hires / input.currentTeamSize) * 100);
  }
  return 0;
}

/** Estimate annual payroll from recent weekly payroll actuals in budget variance lines. */
export function estimateAnnualPayrollFromBudgetLines(
  lines: BudgetVarianceResult[],
  asOfDate: string,
): number | null {
  const payrollLines = lines.filter(
    (l) => l.category === 'payroll' && /^\d{4}-W\d{2}$/.test(l.period),
  );
  if (payrollLines.length === 0) return null;

  const recentPeriods = new Set(getPastWeekPeriods(asOfDate, 4));
  const recent = payrollLines.filter(
    (l) => recentPeriods.has(l.period) && l.actualAmount > 0,
  );
  if (recent.length === 0) return null;

  const avgWeekly =
    recent.reduce((sum, line) => sum + line.actualAmount, 0) / recent.length;
  return Math.round(avgWeekly * 52 * 100) / 100;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.round(value * 10) / 10);
}
