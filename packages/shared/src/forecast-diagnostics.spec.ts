import { describe, expect, it } from 'vitest';
import { computeForecastDiagnostics } from './forecast-diagnostics';

describe('computeForecastDiagnostics', () => {
  const asOfDate = '2026-06-06';

  it('separates overdue AR scheduled in week 1 from on-time AR', () => {
    const result = computeForecastDiagnostics({
      asOfDate,
      openingCash: 236000,
      receivables: [
        {
          outstandingAmount: 70000,
          invoiceDate: '2026-03-01',
          dueDate: '2026-05-01',
        },
        {
          outstandingAmount: 30000,
          invoiceDate: '2026-05-20',
          dueDate: '2026-06-20',
        },
      ],
      payables: [],
    });

    expect(result.overdueArWeek1).toBe(70000);
    expect(result.scheduledArOnDueDate).toBe(30000);
    expect(result.overdueArInvoiceCount).toBe(1);
  });

  it('groups AP by supplier priority without changing totals', () => {
    const result = computeForecastDiagnostics({
      asOfDate,
      openingCash: 100000,
      receivables: [],
      payables: [
        { outstandingAmount: 78000, dueDate: '2026-06-06', supplierPriority: 'payroll' },
        { outstandingAmount: 12000, dueDate: '2026-06-19', supplierPriority: 'flexible' },
      ],
    });

    const payroll = result.apByPriority.find((t) => t.priority === 'payroll');
    const flexible = result.apByPriority.find((t) => t.priority === 'flexible');
    expect(payroll?.totalOutstanding).toBe(78000);
    expect(flexible?.totalOutstanding).toBe(12000);
    expect(result.apDeferrableTotal).toBe(12000);
    expect(result.apEssentialTotal).toBe(78000);
  });
});
