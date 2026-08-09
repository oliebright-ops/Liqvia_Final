import type { TreasuryAiContext } from '../ai/ai-context';

/**
 * A complete, realistic `TreasuryAiContext` for gateway tests.
 *
 * Deliberately populated with identifying data everywhere the real one can carry it
 * — names, narratives, account names, alert messages — so that a test asserting
 * "this did not reach the provider" is asserting something meaningful.
 */
export function makeContext(overrides: Partial<TreasuryAiContext> = {}): TreasuryAiContext {
  return {
    companyName: 'Acme Trading Ltd',
    currency: 'USD',
    asOfDate: '2026-02-01',
    currentCash: 500_000,
    aggregateAccountCount: 2,
    week13ClosingCash: 300_000,
    runwayWeeks: 11,
    weeklyBurn: 40_000,
    liquidityStatus: 'moderate',
    budgetMtdVariance: -5_000,
    budgetVariancePct: -3,
    overdueReceivables: 0,
    upcomingPayables: 0,
    arDue30Days: 0,
    arDelayed90Days: 0,
    apOverdue: 0,
    topBudgetVariances: [],
    recentTransactions: [],
    alerts: [],
    businessMode: 'invoice_driven',
    bankAccounts: [{ name: 'Acme Operating Account', currency: 'USD', balance: 500_000 }],
    cashTransactions: [],
    recentOutflows: [],
    recentInflows: [],
    receivablesDetail: [],
    payablesDetail: [],
    budgetLines: [],
    forecastWeeks: [],
    weeklyActuals: [],
    recurringObligations: [],
    dataModules: {
      bankTransactions: 0,
      receivables: 0,
      payables: 0,
      budgetLines: 0,
      forecastWeeks: 0,
    },
    ...overrides,
  };
}
