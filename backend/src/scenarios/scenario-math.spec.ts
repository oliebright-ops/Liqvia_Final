import { applyScenarioToInput, ForecastCalculationInput } from '@liqvia2/shared';

describe('applyScenarioToInput', () => {
  const base: ForecastCalculationInput = {
    asOfDate: '2026-01-01',
    openingCash: 50000,
    receivables: [{ outstandingAmount: 100000, invoiceDate: '2026-01-01' }],
    payables: [
      { outstandingAmount: 20000, dueDate: '2026-01-15', supplierPriority: 'payroll' },
      { outstandingAmount: 5000, dueDate: '2026-01-20', supplierPriority: 'flexible' },
    ],
  };

  it('reduces receivables by revenue decline percent', () => {
    const out = applyScenarioToInput(base, {
      revenueDeclinePercent: 10,
      payrollIncreasePercent: 0,
      receivableDelayDays: 0,
      expenseGrowthPercent: 0,
    });
    expect(out.receivables[0].outstandingAmount).toBe(90000);
  });

  it('increases payroll payables only by payroll increase percent', () => {
    const out = applyScenarioToInput(base, {
      revenueDeclinePercent: 0,
      payrollIncreasePercent: 20,
      receivableDelayDays: 0,
      expenseGrowthPercent: 0,
    });
    expect(out.payables[0].outstandingAmount).toBe(24000);
    expect(out.payables[1].outstandingAmount).toBe(5000);
  });

  it('grows non-payroll expenses', () => {
    const out = applyScenarioToInput(base, {
      revenueDeclinePercent: 0,
      payrollIncreasePercent: 0,
      receivableDelayDays: 0,
      expenseGrowthPercent: 10,
    });
    expect(out.payables[1].outstandingAmount).toBe(5500);
  });

  it('shifts receivable invoice dates by delay days', () => {
    const out = applyScenarioToInput(base, {
      revenueDeclinePercent: 0,
      payrollIncreasePercent: 0,
      receivableDelayDays: 14,
      expenseGrowthPercent: 0,
    });
    expect(out.receivables[0].invoiceDate).toBe('2026-01-15');
  });
});
