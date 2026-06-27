import { AiService } from './ai.service';
import { TreasuryAiContext } from './ai-context';

describe('AiService rule-based insight', () => {
  const service = new AiService({} as never, {} as never);

  const context: TreasuryAiContext = {
    companyName: 'Demo Consulting Ltd',
    currency: 'USD',
    asOfDate: '2026-01-31',
    currentCash: 60500,
    aggregateAccountCount: 1,
    week13ClosingCash: 42000,
    runwayWeeks: 6,
    weeklyBurn: 5000,
    liquidityStatus: 'high_risk',
    budgetMtdVariance: -1000,
    budgetVariancePct: -2,
    overdueReceivables: 15000,
    upcomingPayables: 22000,
    arDue30Days: 8000,
    arDelayed90Days: 2000,
    apOverdue: 3000,
    topBudgetVariances: [],
    recentTransactions: [],
    alerts: [],
    bankAccounts: [{ name: 'Operating', currency: 'USD', balance: 60500 }],
    cashTransactions: [],
    recentOutflows: [],
    recentInflows: [],
    receivablesDetail: [],
    payablesDetail: [],
    budgetLines: [],
    forecastWeeks: [],
    weeklyActuals: [],
    dataModules: {
      bankTransactions: 0,
      receivables: 0,
      payables: 0,
      budgetLines: 0,
      forecastWeeks: 0,
    },
  };

  it('mentions cash and company name', () => {
    const text = service.ruleBasedInsight(context);
    expect(text).toContain('Demo Consulting Ltd');
    expect(text).toContain('Cash position');
  });

  it('handles null week-13 and runway gracefully', () => {
    const text = service.ruleBasedInsight({
      ...context,
      week13ClosingCash: null,
      runwayWeeks: null,
      aggregateAccountCount: 1,
      weeklyBurn: 0,
      upcomingPayables: 0,
      arDue30Days: null,
      arDelayed90Days: null,
      apOverdue: 0,
      bankAccounts: [],
      cashTransactions: [],
      recentOutflows: [],
      recentInflows: [],
      receivablesDetail: [],
      payablesDetail: [],
      budgetLines: [],
      forecastWeeks: [],
      weeklyActuals: [],
      dataModules: {
        bankTransactions: 0,
        receivables: 0,
        payables: 0,
        budgetLines: 0,
        forecastWeeks: 0,
      },
    });
    expect(text.toLowerCase()).toContain('demo consulting');
  });
});
