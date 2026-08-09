import { buildAiPayload } from './decision-context';
import { makeContext } from './test-fixtures';
import type { TreasuryAiContext } from '../ai/ai-context';

/**
 * Decision-quality regression tests.
 *
 * The privacy refactor is only acceptable if the AI can still reason as well as it
 * did with the old raw payload. Each test below names one capability the product
 * depends on and asserts that the signal carrying it survived the projection.
 *
 * If one of these fails, the correct response is to restore the signal in a
 * non-identifying form — not to relax the test.
 */

const AS_OF = '2026-02-01';

function contextWithBook(): TreasuryAiContext {
  return makeContext({
    asOfDate: AS_OF,
    currency: 'RUB',
    currentCash: 8_000_000,
    weeklyBurn: 600_000,
    overdueReceivables: 2_400_000,
    receivablesDetail: [
      // Large, overdue, materially concentrated — the "critical receivable" case.
      { counterparty: 'Ivan Petrov', amount: 2_400_000, invoiceDate: '2025-12-20', dueDate: '2026-01-20', daysOverdue: 12, status: 'overdue' },
      // Small and current.
      { counterparty: 'Beta LLC', amount: 120_000, invoiceDate: '2026-01-25', dueDate: '2026-03-01', daysOverdue: 0, status: 'open' },
      // Long overdue, moderate size.
      { counterparty: 'Gamma OOO', amount: 600_000, invoiceDate: '2025-09-01', dueDate: '2025-10-01', daysOverdue: 123, status: 'overdue' },
    ],
    payablesDetail: [
      { counterparty: 'Critical Supply', amount: 1_800_000, billDate: '2026-01-02', dueDate: '2026-02-15', daysOverdue: 0, status: 'open', supplierPriority: 'critical' },
      { counterparty: 'Stationery Co', amount: 30_000, billDate: '2026-01-02', dueDate: '2026-02-08', daysOverdue: 0, status: 'open', supplierPriority: 'non_essential' },
    ],
    recurringObligations: [
      { name: 'Payroll February', category: 'payroll', amount: 1_500_000, frequency: 'monthly', dueDate: '2026-02-05', paymentMethod: null, linkedBankAccount: null, confidence: 'high' },
      { name: 'Office fit-out', category: 'other', amount: 400_000, frequency: 'one_off', dueDate: '2026-02-20', paymentMethod: null, linkedBankAccount: null, confidence: 'low' },
    ],
    cashTransactions: [
      { id: '1', date: '2026-01-05', description: 'SALARY RUN JANUARY', category: 'payroll', amount: -1_500_000, direction: 'OUT', accountName: 'Main' },
      { id: '2', date: '2026-02-05', description: 'SALARY RUN FEBRUARY', category: 'payroll', amount: -1_500_000, direction: 'OUT', accountName: 'Main' },
      { id: '3', date: '2025-12-05', description: 'SALARY RUN DECEMBER', category: 'payroll', amount: -1_450_000, direction: 'OUT', accountName: 'Main' },
      { id: '4', date: '2026-01-18', description: 'PAYMENT FROM IVAN PETROV', category: 'customer', amount: 900_000, direction: 'IN', accountName: 'Main' },
    ],
  });
}

function build() {
  return buildAiPayload({ companyId: 'company-1', context: contextWithBook() }).payload;
}

describe('decision quality — counterparty distinctions survive', () => {
  it('keeps three receivables distinguishable from one another', () => {
    const codes = build().receivables.items.map((i) => i.counterpartyCode);
    expect(new Set(codes).size).toBe(3);
  });

  it('keeps Supplier A distinguishable from Supplier B', () => {
    const codes = build().payables.items.map((i) => i.counterpartyCode);
    expect(codes[0]).not.toBe(codes[1]);
  });

  it('preserves the link between a receivable and its size', () => {
    const items = build().receivables.items;
    const largest = [...items].sort((a, b) => b.amount - a.amount)[0]!;
    expect(largest.amount).toBe(2_400_000);
  });
});

describe('decision quality — materiality and risk are still visible', () => {
  it('marks the large overdue receivable CRITICAL and the small one LOW', () => {
    const items = build().receivables.items;
    const large = items.find((i) => i.amount === 2_400_000)!;
    const small = items.find((i) => i.amount === 120_000)!;

    expect(large.cashImpact).toBe('CRITICAL');
    expect(small.cashImpact).toBe('LOW');
  });

  it('exposes concentration risk without naming the concentrated customer', () => {
    const { receivables } = build();
    expect(receivables.topConcentrationPct).toBeGreaterThan(75);
    expect(JSON.stringify(receivables)).not.toContain('Ivan');
  });

  it('distinguishes overdue from current, with ageing', () => {
    const items = build().receivables.items;
    expect(items.filter((i) => i.status === 'overdue')).toHaveLength(2);
    expect(items.find((i) => i.daysOverdue === 123)).toBeDefined();
  });

  it('degrades collection confidence as an invoice ages', () => {
    const items = build().receivables.items;
    const fresh = items.find((i) => i.daysOverdue === 0)!;
    const stale = items.find((i) => i.daysOverdue === 123)!;
    expect(fresh.collectionConfidence!).toBeGreaterThan(stale.collectionConfidence!);
  });

  it('keeps critical payables separable from non-essential ones', () => {
    const items = build().payables.items;
    expect(items.find((i) => i.amount === 1_800_000)!.priority).toBe('critical');
    expect(items.find((i) => i.amount === 30_000)!.priority).toBe('non_essential');
  });
});

describe('decision quality — timing and dependencies survive', () => {
  it('converts due dates into week offsets so payment timing is still reasonable about', () => {
    const items = build().payables.items;
    // 2026-02-15 is two weeks after 2026-02-01.
    expect(items.find((i) => i.amount === 1_800_000)!.dueWeek).toBe(2);
    // Overdue items land in the past.
    expect(build().receivables.items.find((i) => i.daysOverdue === 123)!.dueWeek).toBeLessThan(0);
  });

  it('separates recurring obligations from one-off ones', () => {
    const obligations = build().obligations;
    expect(obligations.find((o) => o.amount === 1_500_000)!.isRecurring).toBe(true);
    expect(obligations.find((o) => o.amount === 400_000)!.isRecurring).toBe(false);
  });

  it('carries forecast confidence per obligation', () => {
    const obligations = build().obligations;
    expect(obligations.find((o) => o.amount === 1_500_000)!.confidence).toBe('high');
    expect(obligations.find((o) => o.amount === 400_000)!.confidence).toBe('low');
  });
});

describe('decision quality — bank narratives become usable structure', () => {
  it('turns repeated payroll narratives into a recurring category with a cadence', () => {
    const payrollOut = build().cashFlowCategories.find(
      (c) => c.category === 'payroll' && c.direction === 'OUT',
    )!;

    expect(payrollOut.count).toBe(3);
    expect(payrollOut.total).toBe(4_450_000);
    expect(payrollOut.isRecurring).toBe(true);
    expect(payrollOut.cadenceDays).toBeGreaterThan(25);
    expect(payrollOut.cadenceDays).toBeLessThan(35);
  });

  it('keeps inflow and outflow categories apart', () => {
    const categories = build().cashFlowCategories;
    expect(categories.find((c) => c.category === 'customer')!.direction).toBe('IN');
    expect(categories.find((c) => c.category === 'payroll')!.direction).toBe('OUT');
  });

  it('carries no narrative text at all', () => {
    const serialised = JSON.stringify(build().cashFlowCategories);
    expect(serialised).not.toContain('SALARY RUN');
    expect(serialised).not.toContain('PETROV');
  });
});

describe('decision quality — liquidity explanation inputs survive', () => {
  it('sends the runway, burn and status needed to explain liquidity risk', () => {
    const { liquidity } = buildAiPayload({
      companyId: 'c',
      context: makeContext({ runwayWeeks: 5.5, weeklyBurn: 90_000, liquidityStatus: 'high_risk' }),
    }).payload;

    expect(liquidity.runwayWeeks).toBe(5.5);
    expect(liquidity.weeklyBurn).toBe(90_000);
    expect(liquidity.liquidityStatus).toBe('high_risk');
  });

  it('reports data coverage so the model can qualify its own confidence', () => {
    const { dataCoverage } = buildAiPayload({
      companyId: 'c',
      context: makeContext({
        dataModules: { bankTransactions: 120, receivables: 8, payables: 3, budgetLines: 0, forecastWeeks: 13 },
      }),
    }).payload;

    expect(dataCoverage.budgetLines).toBe(0);
    expect(dataCoverage.forecastWeeks).toBe(13);
  });

  it('passes Business Pulse inputs — obligations, overdue items and buffer — through intact', () => {
    const payload = build();
    expect(payload.obligations.length).toBeGreaterThan(0);
    expect(payload.receivables.overdueTotal).toBe(2_400_000);
    expect(payload.liquidity.openingCash).toBe(8_000_000);
  });
});

describe('decision quality — the payload is materially richer than a totals-only summary', () => {
  it('carries per-item structure, not just headline totals', () => {
    const payload = build();
    const itemCount = payload.receivables.items.length + payload.payables.items.length;

    expect(itemCount).toBe(5);
    expect(payload.cashFlowCategories.length).toBeGreaterThan(0);
    expect(payload.obligations.length).toBe(2);
  });

  it('exposes at least eight distinct decision signals per receivable', () => {
    const [item] = build().receivables.items;
    expect(Object.keys(item!).sort()).toEqual([
      'amount',
      'cashImpact',
      'collectionConfidence',
      'counterpartyCode',
      'daysOverdue',
      'dueWeek',
      'shareOfTotalPct',
      'status',
    ]);
  });
});
