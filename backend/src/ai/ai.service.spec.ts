import { AiService } from './ai.service';
import { TreasuryAiContext } from './ai-context';

describe('AiService rule-based insight', () => {
  const service = new AiService({} as never, {} as never);

  const context: TreasuryAiContext = {
    companyName: 'Demo Consulting Ltd',
    currency: 'USD',
    asOfDate: '2026-01-31',
    currentCash: 60500,
    week13ClosingCash: 42000,
    runwayWeeks: 6,
    liquidityStatus: 'high_risk',
    overdueReceivables: 15000,
    upcomingPayables: 22000,
    topBudgetVariances: [],
    alerts: [],
  };

  it('mentions cash, runway, and recommendations', () => {
    const text = service.ruleBasedInsight(context);
    expect(text).toContain('Demo Consulting Ltd');
    expect(text).toContain('runway');
    expect(text).toContain('Recommended actions');
    expect(text.toLowerCase()).toContain('overdue');
  });

  it('handles null week-13 and runway gracefully', () => {
    const text = service.ruleBasedInsight({
      ...context,
      week13ClosingCash: null,
      runwayWeeks: null,
    });
    expect(text).toContain('n/a');
    expect(text).toContain('not measurable');
  });
});
