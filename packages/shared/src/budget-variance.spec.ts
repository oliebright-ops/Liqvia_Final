import {
  computeBudgetVarianceAmount,
  computeBudgetVariancePercent,
  isExpenseCategory,
} from './budget-variance';

describe('budget-variance', () => {
  describe('isExpenseCategory', () => {
    it('treats revenue as non-expense', () => {
      expect(isExpenseCategory('revenue')).toBe(false);
    });

    it('treats other categories as expenses', () => {
      expect(isExpenseCategory('expenses')).toBe(true);
      expect(isExpenseCategory('payroll')).toBe(true);
    });
  });

  describe('computeBudgetVarianceAmount', () => {
    it('revenue: actual above budget is positive', () => {
      expect(computeBudgetVarianceAmount('revenue', 100000, 108000)).toBe(8000);
    });

    it('expenses (signed): under budget is positive', () => {
      expect(computeBudgetVarianceAmount('expenses', -680000, -591000)).toBe(89000);
    });

    it('expenses (signed): over budget is negative', () => {
      expect(computeBudgetVarianceAmount('expenses', -680000, -805600)).toBe(-125600);
    });

    it('expenses (positive magnitudes): under budget is positive', () => {
      expect(computeBudgetVarianceAmount('expenses', 680000, 591000)).toBe(89000);
    });
  });

  describe('computeBudgetVariancePercent', () => {
    it('uses absolute budget for expense categories', () => {
      const variance = computeBudgetVarianceAmount('expenses', -680000, -591000);
      expect(computeBudgetVariancePercent('expenses', -680000, variance)).toBe(13.1);
    });
  });
});
