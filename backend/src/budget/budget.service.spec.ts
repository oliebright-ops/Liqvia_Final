import { LiquidityRiskService } from '../treasury/liquidity-risk.service';
import { TreasuryKpiService } from '../treasury/treasury-kpi.service';
import { BudgetService } from './budget.service';

describe('BudgetService variance math', () => {
  const kpis = new TreasuryKpiService(new LiquidityRiskService());
  const service = new BudgetService({} as never, kpis);

  it('computes variance via KPI service', () => {
    const lines = kpis.calculateBudgetVariances([
      { period: '2026-01', category: 'revenue', budgetAmount: 120000, actualAmount: 110000 },
      { period: '2026-01', category: 'payroll', budgetAmount: 45000, actualAmount: 47000 },
    ]);
    expect(lines[0].varianceAmount).toBe(10000);
    expect(lines[0].variancePercent).toBeCloseTo(8.33, 2);
    expect(lines[1].varianceAmount).toBe(-2000);
    expect(service).toBeDefined();
  });

  describe('dedupeRollingForward', () => {
    function dedupe(lines: unknown[]) {
      return (
        service as unknown as {
          dedupeRollingForward: (l: unknown[]) => unknown[];
        }
      ).dedupeRollingForward(lines);
    }

    it('prefers an explicit rolling upload over the auto-generated fallback for the same period/category/account', () => {
      const rollingAuto = {
        period: '2026-W28',
        category: 'revenue',
        budgetType: 'rolling_auto',
        budgetAmount: 100,
        chartOfAccount: { code: '4000-UFA' },
      };
      const rollingUpload = {
        period: '2026-W28',
        category: 'revenue',
        budgetType: 'rolling',
        budgetAmount: 634828,
        chartOfAccount: { code: '4000-UFA' },
      };
      const result = dedupe([rollingAuto, rollingUpload]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(rollingUpload);
    });

    it('keeps distinct lines for different accounts in the same period/category', () => {
      const ufa = {
        period: '2026-W28',
        category: 'revenue',
        budgetType: 'rolling',
        budgetAmount: 634828,
        chartOfAccount: { code: '4000-UFA' },
      };
      const orenburg = {
        period: '2026-W28',
        category: 'revenue',
        budgetType: 'rolling',
        budgetAmount: 333375,
        chartOfAccount: { code: '4000-ORN' },
      };
      const result = dedupe([ufa, orenburg]);
      expect(result).toHaveLength(2);
    });

    it('is a no-op when only the auto-generated fallback exists', () => {
      const rollingAuto = {
        period: '2026-W28',
        category: 'payroll',
        budgetType: 'rolling_auto',
        budgetAmount: 236192,
        chartOfAccount: { code: '6000-UFA' },
      };
      const result = dedupe([rollingAuto]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(rollingAuto);
    });
  });
});
