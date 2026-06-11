import { AlertRulesService } from './alert-rules.service';

describe('AlertRulesService', () => {
  const service = new AlertRulesService();

  const baseLines = Array.from({ length: 13 }, (_, i) => ({
    weekIndex: i + 1,
    weekStart: `2026-02-${String(i + 1).padStart(2, '0')}`,
    openingCash: 50_000,
    forecastInflows: 10_000,
    forecastOutflows: 8_000,
    closingCash: 52_000,
    liquidityStatus: 'healthy' as const,
  }));

  it('fires critical alert for negative projected cash', () => {
    const lines = [...baseLines];
    lines[5] = { ...lines[5], closingCash: -1_000 };
    const alerts = service.evaluate({
      forecastLines: lines,
      overdueReceivables: 0,
      upcomingPayables: 0,
      runwayWeeks: 10,
      liquidityStatus: 'moderate',
    });
    expect(alerts.some((a) => a.alertType === 'negative_cash' && a.severity === 'critical')).toBe(
      true,
    );
  });

  it('fires delayed collection alert above threshold', () => {
    const alerts = service.evaluate({
      forecastLines: baseLines,
      overdueReceivables: 15_000,
      upcomingPayables: 0,
      runwayWeeks: 12,
      liquidityStatus: 'moderate',
    });
    expect(alerts.some((a) => a.alertType === 'delayed_collection')).toBe(true);
  });

  it('fires runway warning below 8 weeks', () => {
    const alerts = service.evaluate({
      forecastLines: baseLines,
      overdueReceivables: 0,
      upcomingPayables: 0,
      runwayWeeks: 6,
      liquidityStatus: 'high_risk',
    });
    expect(alerts.some((a) => a.alertType === 'runway')).toBe(true);
  });
});
