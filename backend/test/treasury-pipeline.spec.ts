import { ForecastCalculationService } from '../src/treasury/forecast-calculation.service';
import { LiquidityRiskService } from '../src/treasury/liquidity-risk.service';
import { TreasuryKpiService } from '../src/treasury/treasury-kpi.service';
import { AlertRulesService } from '../src/treasury/alert-rules.service';
import {
  criticalCompanyInput,
  healthyCompanyInput,
  overdueReceivables,
  upcomingPayables,
} from './fixtures/treasury-fixtures';

describe('Treasury pipeline (forecast -> KPIs -> alerts)', () => {
  const liquidity = new LiquidityRiskService();
  const forecast = new ForecastCalculationService();
  const kpis = new TreasuryKpiService(liquidity);
  const alerts = new AlertRulesService();

  function runPipeline(input: typeof healthyCompanyInput) {
    const lines = forecast.calculateBaselineForecast(input);
    const weeklyNetBurn = kpis.calculateWeeklyNetBurn(
      lines.map((l) => ({
        weekStart: l.weekStart,
        inflows: l.forecastInflows,
        outflows: l.forecastOutflows,
      })),
    );
    const runwayWeeks = liquidity.calculateRunwayWeeks(input.openingCash, weeklyNetBurn);
    const liquidityStatus = liquidity.resolveLiquidityStatus({
      currentCash: input.openingCash,
      runwayWeeks,
      forecastLines: lines,
    });
    const generated = alerts.evaluate({
      forecastLines: lines,
      overdueReceivables: 40000,
      upcomingPayables: 74000,
      runwayWeeks,
      liquidityStatus,
    });
    return { lines, weeklyNetBurn, runwayWeeks, liquidityStatus, alerts: generated };
  }

  it('produces a 13-week forecast for each profile', () => {
    expect(forecast.calculateBaselineForecast(healthyCompanyInput)).toHaveLength(13);
    expect(forecast.calculateBaselineForecast(criticalCompanyInput)).toHaveLength(13);
  });

  it('ranks the healthy company with stronger week-13 cash than the critical company', () => {
    const healthy = runPipeline(healthyCompanyInput);
    const critical = runPipeline(criticalCompanyInput);

    const healthyW13 = healthy.lines[12].closingCash;
    const criticalW13 = critical.lines[12].closingCash;
    expect(healthyW13).toBeGreaterThan(criticalW13);
  });

  it('raises alerts for the critical company', () => {
    const critical = runPipeline(criticalCompanyInput);
    expect(critical.alerts.length).toBeGreaterThan(0);
  });

  it('ranks liquidity status using runway and projected cash flow', () => {
    const healthy = runPipeline(healthyCompanyInput);
    const critical = runPipeline(criticalCompanyInput);

    expect(['healthy', 'moderate']).toContain(healthy.liquidityStatus);
    expect(['critical', 'high_risk']).toContain(critical.liquidityStatus);
    expect(healthy.lines.some((l) => l.closingCash < 0)).toBe(false);
    expect(critical.lines.some((l) => l.closingCash < 0)).toBe(true);
  });

  it('flags overdue receivables and upcoming payables above thresholds', () => {
    const overdue = kpis.calculateOverdueReceivables(overdueReceivables, '2026-06-01');
    const upcoming = kpis.calculateUpcomingPayables(upcomingPayables, '2026-06-01', 14);
    expect(overdue).toBeGreaterThan(0);
    expect(upcoming).toBeGreaterThan(0);
  });
});
