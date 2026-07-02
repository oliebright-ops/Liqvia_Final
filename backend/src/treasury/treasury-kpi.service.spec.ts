import { LiquidityRiskService } from './liquidity-risk.service';
import { TreasuryKpiService } from './treasury-kpi.service';

describe('TreasuryKpiService', () => {
  const service = new TreasuryKpiService(new LiquidityRiskService());
  const asOf = '2026-01-31';

  it('sums latest balance across all accounts', () => {
    const cash = service.calculateCurrentCash([
      { balance: 50000, balanceDate: '2026-01-15' },
      { balance: 30000, balanceDate: '2026-01-31' },
      { balance: 12000, balanceDate: '2026-01-31' },
    ]);
    expect(cash).toBe(92000);
  });

  it('returns week 13 closing cash', () => {
    const closing = service.calculateWeek13ClosingCash([
      { weekIndex: 12, closingCash: 40000 },
      { weekIndex: 13, closingCash: 38500 },
    ]);
    expect(closing).toBe(38500);
  });

  it('averages positive weekly net burn over lookback', () => {
    const burn = service.calculateWeeklyNetBurn([
      { weekStart: '2026-W01', inflows: 20000, outflows: 30000 },
      { weekStart: '2026-W02', inflows: 18000, outflows: 28000 },
      { weekStart: '2026-W03', inflows: 22000, outflows: 32000 },
      { weekStart: '2026-W04', inflows: 22000, outflows: 32000 },
    ]);
    expect(burn).toBe(10000);
  });

  it('uses the nearest upcoming weeks, not the farthest, when weeks exceed the lookback', () => {
    // Regression for F9: forecasts always run forward (week 1 nearest -> week 13 farthest).
    // Weeks 1-4 carry real near-term burn; weeks 5-13 are flat/no-burn placeholders that
    // stand in for a distant, unaffected tail. A 4-week lookback must pick weeks 1-4.
    const weeks = [
      { weekStart: '2026-W01', inflows: 10000, outflows: 25000 }, // burn 15000
      { weekStart: '2026-W02', inflows: 10000, outflows: 23000 }, // burn 13000
      { weekStart: '2026-W03', inflows: 10000, outflows: 21000 }, // burn 11000
      { weekStart: '2026-W04', inflows: 10000, outflows: 19000 }, // burn 9000
      { weekStart: '2026-W05', inflows: 20000, outflows: 20000 }, // burn 0 (flat tail)
      { weekStart: '2026-W06', inflows: 20000, outflows: 20000 },
      { weekStart: '2026-W07', inflows: 20000, outflows: 20000 },
      { weekStart: '2026-W08', inflows: 20000, outflows: 20000 },
    ];
    const burn = service.calculateWeeklyNetBurn(weeks);
    expect(burn).toBe(12000); // avg of 15000, 13000, 11000, 9000 — near-term weeks only
  });

  it('sums overdue receivables', () => {
    const overdue = service.calculateOverdueReceivables(
      [
        {
          outstandingAmount: 15000,
          invoiceDate: '2025-12-01',
          dueDate: '2025-12-31',
        },
        {
          outstandingAmount: 5000,
          invoiceDate: '2026-01-10',
          dueDate: '2026-02-15',
        },
      ],
      asOf,
    );
    expect(overdue).toBe(15000);
  });

  it('sums upcoming payables within 14-day window', () => {
    const upcoming = service.calculateUpcomingPayables(
      [
        { outstandingAmount: 22000, billDate: '2026-01-01', dueDate: '2026-02-10' },
        { outstandingAmount: 1200, billDate: '2026-01-10', dueDate: '2026-03-01' },
      ],
      asOf,
    );
    expect(upcoming).toBe(22000);
  });

  it('calculates budget variance amount and percent', () => {
    const [row] = service.calculateBudgetVariances([
      { period: '2026-01', category: 'revenue', budgetAmount: 100000, actualAmount: 92000 },
    ]);
    expect(row.varianceAmount).toBe(-8000);
    expect(row.variancePercent).toBe(-8);
  });

  it('expense under budget is positive variance', () => {
    const [row] = service.calculateBudgetVariances([
      { period: '2026-W10', category: 'expenses', budgetAmount: -680000, actualAmount: -591000 },
    ]);
    expect(row.varianceAmount).toBe(89000);
    expect(row.variancePercent).toBe(13.1);
  });

  it('expense over budget is negative variance', () => {
    const [row] = service.calculateBudgetVariances([
      { period: '2026-W11', category: 'expenses', budgetAmount: -680000, actualAmount: -805600 },
    ]);
    expect(row.varianceAmount).toBe(-125600);
    expect(row.variancePercent).toBe(-18.5);
  });

  it('calculates forecast variance as actual minus forecast', () => {
    expect(service.calculateForecastVariance(42000, 38500)).toBe(3500);
  });

  it('calculates weighted collection days', () => {
    const days = service.calculateCollectionDays(
      [
        { outstandingAmount: 10000, invoiceDate: '2026-01-01', dueDate: '2026-01-31' },
        { outstandingAmount: 5000, invoiceDate: '2025-12-01', dueDate: '2025-12-31' },
      ],
      asOf,
    );
    expect(days).toBeCloseTo(40, 0);
  });

  it('builds full dashboard snapshot', () => {
    const dashboard = service.buildDashboard({
      currency: 'USD',
      asOfDate: asOf,
      bankBalances: [
        { balance: 48500, balanceDate: asOf },
        { balance: 12000, balanceDate: asOf },
      ],
      forecastLines: [{ weekIndex: 13, closingCash: 52000 }],
      weeklyCashFlows: [
        { weekStart: '2026-W01', inflows: 20000, outflows: 30000 },
        { weekStart: '2026-W02', inflows: 20000, outflows: 30000 },
        { weekStart: '2026-W03', inflows: 20000, outflows: 30000 },
        { weekStart: '2026-W04', inflows: 20000, outflows: 30000 },
      ],
      receivables: [{ outstandingAmount: 15000, invoiceDate: '2025-12-01', dueDate: '2025-12-31' }],
      payables: [{ outstandingAmount: 22000, billDate: '2026-01-01', dueDate: '2026-02-10' }],
      budgetActuals: [
        { period: '2026-01', category: 'payroll', budgetAmount: 45000, actualAmount: 47000 },
      ],
      actualCashForForecastVariance: 60500,
    });

    expect(dashboard.currentCash).toBe(60500);
    expect(dashboard.week13ClosingCash).toBe(52000);
    expect(dashboard.weeklyNetBurn).toBe(10000);
    expect(dashboard.runwayWeeks).toBe(6.05);
    expect(dashboard.liquidityStatus).toBe('high_risk');
    expect(dashboard.overdueReceivables).toBe(15000);
    expect(dashboard.forecastVarianceAmount).toBe(8500);
  });
});
