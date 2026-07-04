import { decisionQuestionText, toScenarioVariables } from './decision-mapping';

describe('toScenarioVariables', () => {
  it('maps hire to a payroll increase, using the default percent when none given', () => {
    expect(toScenarioVariables('hire')).toEqual({ payrollIncreasePercent: 10 });
    expect(toScenarioVariables('hire', undefined, 25)).toEqual({ payrollIncreasePercent: 25 });
  });

  it('maps buy_equipment/withdraw_funds/repay_debt to a week-1 one-off outflow', () => {
    expect(toScenarioVariables('buy_equipment', 15000)).toEqual({
      oneOffOutflowAmount: 15000,
      oneOffOutflowWeek: 1,
    });
    expect(toScenarioVariables('withdraw_funds', 3000)).toEqual({
      oneOffOutflowAmount: 3000,
      oneOffOutflowWeek: 1,
    });
    expect(toScenarioVariables('repay_debt', 20000)).toEqual({
      oneOffOutflowAmount: 20000,
      oneOffOutflowWeek: 1,
    });
  });

  it('maps expand to revenue growth plus a smaller payroll increase', () => {
    const result = toScenarioVariables('expand', undefined, 20);
    expect(result).toEqual({ revenueGrowthPercent: 20, payrollIncreasePercent: 10 });
  });

  it('returns null for custom — it has no fixed scenario shape', () => {
    expect(toScenarioVariables('custom')).toBeNull();
  });
});

describe('decisionQuestionText', () => {
  it('produces a readable question per preset type', () => {
    expect(decisionQuestionText('hire', undefined, 10)).toContain('10%');
    expect(decisionQuestionText('buy_equipment', 5000)).toContain('5000');
    expect(decisionQuestionText('custom')).toBe('');
  });
});
