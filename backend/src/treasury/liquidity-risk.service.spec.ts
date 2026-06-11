import { LiquidityRiskService } from './liquidity-risk.service';

describe('LiquidityRiskService', () => {
  const service = new LiquidityRiskService();

  it('calculates runway as cash / weekly burn', () => {
    expect(service.calculateRunwayWeeks(80000, 10000)).toBe(8);
  });

  it('returns null runway when burn is zero', () => {
    expect(service.calculateRunwayWeeks(50000, 0)).toBeNull();
  });

  it('returns zero runway when cash is exhausted', () => {
    expect(service.calculateRunwayWeeks(0, 10000)).toBe(0);
  });

  it('classifies healthy above 16 weeks', () => {
    expect(service.classifyLiquidity(20)).toBe('healthy');
  });

  it('classifies moderate between 8 and 16 weeks', () => {
    expect(service.classifyLiquidity(10)).toBe('moderate');
    expect(service.classifyLiquidity(16)).toBe('moderate');
  });

  it('classifies high risk between 4 and 8 weeks', () => {
    expect(service.classifyLiquidity(6)).toBe('high_risk');
    expect(service.classifyLiquidity(4)).toBe('high_risk');
  });

  it('classifies critical below 4 weeks', () => {
    expect(service.classifyLiquidity(2)).toBe('critical');
  });

  it('treats null runway as healthy when cash is not burning', () => {
    expect(service.classifyLiquidity(null)).toBe('healthy');
  });

  it('marks negative projected closing cash as critical for a week', () => {
    expect(service.classifyWeekLiquidity(-1200, 10)).toBe('critical');
  });

  it('downgrades status when projection shows near-term negative cash', () => {
    const status = service.resolveLiquidityStatus({
      currentCash: 120000,
      runwayWeeks: 20,
      forecastLines: [
        { weekIndex: 1, closingCash: 90000 },
        { weekIndex: 2, closingCash: -5000 },
        { weekIndex: 13, closingCash: 40000 },
      ],
    });
    expect(status).toBe('critical');
  });

  it('downgrades status when week-13 closing cash is negative', () => {
    const status = service.resolveLiquidityStatus({
      currentCash: 50000,
      runwayWeeks: 10,
      forecastLines: [
        { weekIndex: 1, closingCash: 45000 },
        { weekIndex: 13, closingCash: -2000 },
      ],
    });
    expect(status).toBe('critical');
  });

  it('keeps healthy runway when projection stays positive', () => {
    const status = service.resolveLiquidityStatus({
      currentCash: 200000,
      runwayWeeks: 20,
      forecastLines: [
        { weekIndex: 1, closingCash: 195000 },
        { weekIndex: 13, closingCash: 180000 },
      ],
    });
    expect(status).toBe('healthy');
  });

  it('averages forward weekly net burn across remaining weeks', () => {
    const burn = service.averageWeeklyNetBurn([
      { inflows: 10000, outflows: 20000 },
      { inflows: 15000, outflows: 18000 },
      { inflows: 30000, outflows: 10000 },
    ]);
    expect(burn).toBe(6500);
  });
});
