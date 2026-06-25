import { describe, expect, it } from 'vitest';
import { computeForecastBacktest } from './forecast-backtest';
import { getPastWeekPeriods } from './rolling-budget';

describe('computeForecastBacktest', () => {
  const asOfDate = '2026-06-06';

  it('returns insufficient when fewer than 2 weeks of actuals exist', () => {
    const periods = getPastWeekPeriods(asOfDate, 14);
    const result = computeForecastBacktest({
      asOfDate,
      lookbackWeeks: 2,
      weeklyActuals: [
        { period: periods[0], category: 'revenue', amount: 20000 },
        { period: periods[0], category: 'payroll', amount: 8000 },
      ],
    });
    expect(result.quality).toBe('insufficient');
    expect(result.netCashWeeks).toBe(0);
  });

  it('computes rolling net backtest when enough history exists', () => {
    const periods = getPastWeekPeriods(asOfDate, 14).slice(0, 5);
    const weeklyActuals = periods.flatMap((period) => [
      { period, category: 'revenue' as const, amount: 22000 },
      { period, category: 'payroll' as const, amount: 10000 },
      { period, category: 'expenses' as const, amount: 4000 },
    ]);

    const result = computeForecastBacktest({
      asOfDate,
      lookbackWeeks: 2,
      weeklyActuals,
    });

    expect(result.netCashWeeks).toBeGreaterThan(0);
    expect(result.meanAbsoluteNetError).not.toBeNull();
    expect(result.sampleNetWeeks.length).toBeGreaterThan(0);
  });

  it('derives budget MAPE from variance lines in the window', () => {
    const periods = getPastWeekPeriods(asOfDate, 2);
    const result = computeForecastBacktest({
      asOfDate,
      lookbackWeeks: 2,
      weeklyActuals: periods.flatMap((period) => [
        { period, category: 'revenue' as const, amount: 24000 },
        { period, category: 'payroll' as const, amount: 10000 },
      ]),
      budgetVarianceLines: periods.map((period) => ({
        period,
        category: 'revenue',
        budgetAmount: 25000,
        actualAmount: 24000,
        varianceAmount: 1000,
        variancePercent: 4,
      })),
    });

    expect(result.budgetVarianceLineCount).toBe(2);
    expect(result.meanAbsoluteBudgetErrorPercent).toBe(4);
  });
});
