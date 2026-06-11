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
});
