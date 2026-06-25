import { describe, expect, it } from 'vitest';
import {
  estimateAnnualPayrollFromBudgetLines,
  payrollIncreaseFromHires,
} from './scenario-utils';

describe('payrollIncreaseFromHires', () => {
  it('uses team size ratio when payroll base is unknown', () => {
    expect(
      payrollIncreaseFromHires({
        hires: 3,
        annualSalaryPerHire: 45000,
        currentTeamSize: 25,
      }),
    ).toBe(12);
  });

  it('uses annual payroll when provided', () => {
    expect(
      payrollIncreaseFromHires({
        hires: 2,
        annualSalaryPerHire: 50000,
        currentAnnualPayroll: 500000,
      }),
    ).toBe(20);
  });
});

describe('estimateAnnualPayrollFromBudgetLines', () => {
  it('annualises recent weekly payroll actuals', () => {
    const payroll = estimateAnnualPayrollFromBudgetLines(
      [
        {
          period: '2026-W20',
          category: 'payroll',
          budgetAmount: 10000,
          actualAmount: 10000,
          varianceAmount: 0,
          variancePercent: 0,
        },
        {
          period: '2026-W21',
          category: 'payroll',
          budgetAmount: 10000,
          actualAmount: 12000,
          varianceAmount: -2000,
          variancePercent: -20,
        },
      ],
      '2026-06-06',
    );
    expect(payroll).not.toBeNull();
    expect(payroll!).toBeGreaterThan(0);
  });
});
