import { describe, expect, it } from 'vitest';
import {
  buildRollingBudgetFromPrior,
  buildRollingForecastAdjustments,
  computeRollingAverage,
  computeRollingVariance,
  getFutureWeekPeriods,
  getPastWeekPeriods,
} from './rolling-budget';

describe('rolling-budget', () => {
  const asOfDate = '2026-06-06';

  it('computes rolling average from last 2 weeks', () => {
    const periods = getPastWeekPeriods(asOfDate, 4);
    const rows = periods.flatMap((period, i) => [
      { period, category: 'revenue' as const, amount: 20000 + i * 1000 },
      { period, category: 'payroll' as const, amount: 10000 },
      { period, category: 'expenses' as const, amount: 5000 },
    ]);

    const avg = computeRollingAverage(rows, 2, asOfDate);
    expect(avg.sourcePeriods).toHaveLength(2);
    expect(avg.avgInflows).toBeGreaterThan(0);
    expect(avg.avgOutflows).toBe(15000);
  });

  it('treats negative expense actuals as positive outflow magnitudes', () => {
    const periods = getPastWeekPeriods(asOfDate, 2);
    const rows = periods.flatMap((period) => [
      { period, category: 'revenue' as const, amount: 22000 },
      { period, category: 'expenses' as const, amount: -6000 },
      { period, category: 'payroll' as const, amount: -4000 },
    ]);
    const avg = computeRollingAverage(rows, 2, asOfDate);
    expect(avg.avgInflows).toBe(22000);
    expect(avg.avgOutflows).toBe(10000);
  });

  it('builds 13 weekly forecast adjustments', () => {
    const periods = getPastWeekPeriods(asOfDate, 2);
    const rows = periods.flatMap((period) => [
      { period, category: 'revenue' as const, amount: 22000 },
      { period, category: 'expenses' as const, amount: 6000 },
    ]);
    const adj = buildRollingForecastAdjustments(rows, 2, asOfDate);
    expect(adj).toHaveLength(13);
    expect(adj[0].inflows).toBe(22000);
    expect(adj[0].outflows).toBe(6000);
  });

  it('derives forward rolling budget from prior period', () => {
    const periods = getPastWeekPeriods(asOfDate, 2);
    const priorRows = periods.flatMap((period) => [
      { period, category: 'revenue' as const, amount: 30000 },
      { period, category: 'payroll' as const, amount: 12000 },
    ]);
    const lines = buildRollingBudgetFromPrior(priorRows, 2, asOfDate);
    expect(lines.length).toBeGreaterThan(0);
    expect(getFutureWeekPeriods(asOfDate)).toContain(lines[0].period);
    expect(lines[0].budgetType).toBe('rolling_auto');
  });

  it('computes variance for matching budget and actual periods', () => {
    const periods = getPastWeekPeriods(asOfDate, 2);
    const budgetRows = periods.map((period) => ({
      period,
      category: 'revenue' as const,
      amount: 25000,
    }));
    const actualRows = periods.map((period) => ({
      period,
      category: 'revenue' as const,
      amount: 24000,
    }));
    const lines = computeRollingVariance(budgetRows, actualRows, asOfDate);
    expect(lines).toHaveLength(2);
    expect(lines[0].varianceAmount).toBe(1000);
  });
});
