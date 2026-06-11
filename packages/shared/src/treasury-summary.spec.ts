import { describe, expect, it } from 'vitest';
import { computeBudgetExecutiveVariance } from './treasury-summary';

describe('computeBudgetExecutiveVariance', () => {
  const lines = [
    {
      period: '2024-05',
      category: 'revenue',
      budgetAmount: 150_000,
      actualAmount: 145_000,
      varianceAmount: 5_000,
      variancePercent: 3.3,
    },
    {
      period: '2024-05',
      category: 'payroll',
      budgetAmount: 65_000,
      actualAmount: 68_000,
      varianceAmount: -3_000,
      variancePercent: -4.6,
    },
    {
      period: '2024-05',
      category: 'expenses',
      budgetAmount: 20_000,
      actualAmount: 22_000,
      varianceAmount: -2_000,
      variancePercent: -10,
    },
  ];

  it('uses MTD lines when current month has budget data', () => {
    const result = computeBudgetExecutiveVariance(
      { totalBudget: 235_000, totalActual: 235_000, totalVariance: 0, lines },
      '2024-05-15',
    );
    expect(result.mtdVariance).toBe(0);
    expect(result.period).toBe('2024-05');
    expect(result.hasData).toBe(true);
  });

  it('falls back to budgetVsActual.totalVariance when MTD month has no lines', () => {
    const result = computeBudgetExecutiveVariance(
      { totalBudget: 235_000, totalActual: 235_000, totalVariance: 0, lines },
      '2024-06-07',
    );
    expect(result.mtdVariance).toBe(0);
    expect(result.variancePct).toBe(0);
    expect(result.period).toBe('2024-05');
    expect(result.hasData).toBe(true);
  });

  it('returns hasData false when no budget lines exist', () => {
    const result = computeBudgetExecutiveVariance(
      { totalBudget: 0, totalActual: 0, totalVariance: 0, lines: [] },
      '2024-06-07',
    );
    expect(result.hasData).toBe(false);
    expect(result.mtdVariance).toBeNull();
  });
});
