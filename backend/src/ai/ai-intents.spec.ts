import {
  formatReceivablesReply,
  formatRisksReply,
  formatRunwayReply,
  ruleBasedReplyByIntent,
} from './ai-replies';
import { analyzeUserQuery, type TreasuryAiContext } from './ai-context';

describe('AI CFO intent routing', () => {
  const baseContext: TreasuryAiContext = {
    companyName: 'Acme Construction',
    currency: 'USD',
    asOfDate: '2026-06-27',
    currentCash: 236000,
    aggregateAccountCount: 2,
    week13ClosingCash: 447000,
    runwayWeeks: 35.2,
    weeklyBurn: 6700,
    liquidityStatus: 'healthy',
    budgetMtdVariance: -2000,
    budgetVariancePct: -4,
    overdueReceivables: 70000,
    upcomingPayables: 45000,
    arDue30Days: 120000,
    arDelayed90Days: 15000,
    apOverdue: 8000,
    freeAvailableCash: -74000,
    fixedOutflowsHorizon: 300000,
    horizonWeeks: 13,
    topBudgetVariances: [],
    recentTransactions: [],
    alerts: [],
    bankAccounts: [{ name: 'Operating', currency: 'USD', balance: 236000 }],
    cashTransactions: [
      {
        id: '1',
        date: '2026-06-20',
        description: 'Steel supplier payment',
        category: 'supplier',
        amount: 12000,
        direction: 'OUT',
        accountName: 'Operating',
      },
    ],
    recentOutflows: [
      {
        id: '1',
        date: '2026-06-20',
        description: 'Steel supplier payment',
        category: 'supplier',
        amount: 12000,
        direction: 'OUT',
        accountName: 'Operating',
      },
    ],
    recentInflows: [],
    receivablesDetail: [
      {
        counterparty: 'Customer A',
        amount: 18000,
        invoiceDate: '2026-04-01',
        dueDate: '2026-05-10',
        daysOverdue: 48,
        status: 'overdue',
      },
    ],
    payablesDetail: [
      {
        counterparty: 'Supplier X',
        amount: 5000,
        billDate: '2026-06-01',
        dueDate: '2026-06-30',
        daysOverdue: 0,
        status: 'open',
        supplierPriority: 'flexible',
      },
    ],
    budgetLines: [],
    forecastWeeks: [],
    weeklyActuals: [],
    dataModules: {
      bankTransactions: 1,
      receivables: 1,
      payables: 1,
      budgetLines: 0,
      forecastWeeks: 0,
    },
  };

  it('routes runway intent with company-specific numbers', () => {
    const text = formatRunwayReply(baseContext);
    expect(text).toContain('Acme Construction');
    expect(text).toContain('35.2 weeks');
    expect(text).toContain('236');
  });

  it('routes risks differently from cash position', () => {
    const risks = formatRisksReply(baseContext);
    const cash = ruleBasedReplyByIntent(baseContext, 'cash_position');
    expect(risks).toContain('Financial risks');
    expect(cash).toContain('Cash position');
    expect(risks).not.toBe(cash);
  });

  it('detects Russian supplier question as payables', () => {
    const q = 'Каким поставщикам нужно заплатить на этой неделе?';
    const analysis = analyzeUserQuery(q, baseContext);
    expect(analysis.intent).toBe('payables');
  });

  it('detects Russian runway question', () => {
    const q = 'Какой у меня сейчас запас денежных средств?';
    const analysis = analyzeUserQuery(q, baseContext);
    expect(analysis.intent).toBe('runway');
  });

  it('formats receivables with counterparty names', () => {
    const text = formatReceivablesReply(baseContext);
    expect(text).toContain('Customer A');
    expect(text).toContain('18');
  });
});
