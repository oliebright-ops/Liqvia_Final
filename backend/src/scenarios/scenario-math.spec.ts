import { applyScenarioToInput, ForecastCalculationInput } from '@liqvia2/shared';
import { DEFAULT_SCENARIO_VARIABLES } from '@liqvia2/shared';

describe('applyScenarioToInput', () => {
  const base: ForecastCalculationInput = {
    asOfDate: '2026-01-01',
    openingCash: 50000,
    receivables: [{ outstandingAmount: 100000, invoiceDate: '2026-01-01' }],
    payables: [
      { outstandingAmount: 20000, dueDate: '2026-01-15', supplierPriority: 'payroll' },
      { outstandingAmount: 5000, dueDate: '2026-01-20', supplierPriority: 'flexible' },
      { outstandingAmount: 3000, dueDate: '2026-01-25', supplierPriority: 'tax' },
    ],
  };

  const neutral = DEFAULT_SCENARIO_VARIABLES;

  it('reduces receivables by revenue decline percent', () => {
    const out = applyScenarioToInput(base, { ...neutral, revenueDeclinePercent: 10 });
    expect(out.receivables[0].outstandingAmount).toBe(90000);
  });

  it('increases receivables by revenue growth percent', () => {
    const out = applyScenarioToInput(base, { ...neutral, revenueGrowthPercent: 10 });
    expect(out.receivables[0].outstandingAmount).toBeCloseTo(110000, 2);
  });

  it('increases payroll payables only by payroll increase percent', () => {
    const out = applyScenarioToInput(base, { ...neutral, payrollIncreasePercent: 20 });
    expect(out.payables[0].outstandingAmount).toBe(24000);
    expect(out.payables[1].outstandingAmount).toBe(5000);
    expect(out.payables[2].outstandingAmount).toBe(3000);
  });

  it('grows non-payroll expenses and tax separately', () => {
    const out = applyScenarioToInput(base, {
      ...neutral,
      expenseGrowthPercent: 10,
      taxIncreasePercent: 20,
    });
    expect(out.payables[1].outstandingAmount).toBe(5500);
    expect(out.payables[2].outstandingAmount).toBe(3600);
  });

  it('shifts receivable invoice dates by delay days', () => {
    const out = applyScenarioToInput(base, { ...neutral, receivableDelayDays: 14 });
    expect(out.receivables[0].invoiceDate).toBe('2026-01-15');
  });

  it('shifts payable due dates by payable delay days', () => {
    const out = applyScenarioToInput(base, { ...neutral, payableDelayDays: 10 });
    expect(out.payables[0].dueDate).toBe('2026-01-25');
  });

  it('adds one-off outflow adjustment for target week', () => {
    const out = applyScenarioToInput(base, {
      ...neutral,
      oneOffOutflowAmount: 25000,
      oneOffOutflowWeek: 4,
    });
    expect(out.weeklyAdjustments).toEqual([{ weekIndex: 4, outflows: 25000 }]);
  });
});
