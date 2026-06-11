import { describe, expect, it } from 'vitest';
import { buildForecastModel } from './forecast-model';
import { getPastWeekPeriods } from './rolling-budget';

describe('buildForecastModel', () => {
  it('places overdue AR/AP in week 1', () => {
    const result = buildForecastModel({
      asOfDate: '2026-06-01',
      openingCash: 100_000,
      receivables: [
        {
          id: 'ar-1',
          counterparty: 'Late Co',
          dueDate: '2026-05-20',
          outstandingAmount: 5_000,
        },
      ],
      payables: [
        {
          id: 'ap-1',
          counterparty: 'Vendor',
          dueDate: '2026-05-28',
          outstandingAmount: 3_000,
        },
      ],
    });

    expect(result.weeks[0].arApInflows).toBe(5_000);
    expect(result.weeks[0].arApOutflows).toBe(3_000);
    expect(result.weeks[0].entries).toHaveLength(2);
  });

  it('matches header projected closing with grid week 13', () => {
    const result = buildForecastModel({
      asOfDate: '2026-06-01',
      openingCash: 225_000,
      receivables: [
        { id: '1', counterparty: 'A', dueDate: '2026-06-12', outstandingAmount: 32_400 },
      ],
      payables: [
        { id: '2', counterparty: 'Payroll', dueDate: '2026-06-06', outstandingAmount: 34_000 },
      ],
    });

    expect(result.projectedClosing).toBe(result.weeks[12].closingCash);
  });

  it('excludes payables due beyond the horizon instead of clamping them', () => {
    const short = buildForecastModel({
      asOfDate: '2026-06-11',
      openingCash: 100_000,
      horizonWeeks: 4,
      receivables: [],
      payables: [
        { id: 'ap-near', counterparty: 'Near', dueDate: '2026-06-20', outstandingAmount: 5_000 },
        { id: 'ap-far', counterparty: 'Far', dueDate: '2026-08-01', outstandingAmount: 9_000 },
      ],
    });
    const long = buildForecastModel({
      asOfDate: '2026-06-11',
      openingCash: 100_000,
      horizonWeeks: 13,
      receivables: [],
      payables: [
        { id: 'ap-near', counterparty: 'Near', dueDate: '2026-06-20', outstandingAmount: 5_000 },
        { id: 'ap-far', counterparty: 'Far', dueDate: '2026-08-01', outstandingAmount: 9_000 },
      ],
    });

    const shortApTotal = short.weeks.reduce((s, w) => s + w.arApOutflows, 0);
    const longApTotal = long.weeks.reduce((s, w) => s + w.arApOutflows, 0);
    expect(shortApTotal).toBe(5_000);
    expect(longApTotal).toBe(14_000);
  });

  it('respects a custom horizon length', () => {
    const result = buildForecastModel({
      asOfDate: '2026-06-01',
      openingCash: 50_000,
      horizonWeeks: 8,
      receivables: [],
      payables: [],
    });

    expect(result.weeks).toHaveLength(8);
    expect(result.horizonWeeks).toBe(8);
    expect(result.projectedClosing).toBe(result.weeks[7].closingCash);
  });

  it('computes net cash flow when rolling actual expenses are negative', () => {
    const asOfDate = '2026-06-06';
    const periods = getPastWeekPeriods(asOfDate, 2);
    const result = buildForecastModel({
      asOfDate,
      openingCash: 1_000_000,
      receivables: [],
      payables: [],
      weeklyActuals: periods.flatMap((period) => [
        { period, category: 'revenue' as const, amount: 268_875 },
        { period, category: 'expenses' as const, amount: -888_700 },
      ]),
      forecastLookbackWeeks: 2,
    });

    const week = result.weeks[0];
    expect(week.forecastInflows).toBe(268_875);
    expect(week.forecastOutflows).toBe(888_700);
    expect(week.netCashFlow).toBe(268_875 - 888_700);
  });
});
