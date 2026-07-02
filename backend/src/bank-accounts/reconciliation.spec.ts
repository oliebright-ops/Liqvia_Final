import { matchBankMovements } from '@liqvia2/shared';

describe('matchBankMovements', () => {
  const receivables = [
    { id: 'ar-1', counterparty: 'Customer A', amount: 10000, dueDate: '2026-06-10' },
    { id: 'ar-2', counterparty: 'Customer B', amount: 5000, dueDate: '2026-06-15' },
  ];
  const payables = [
    { id: 'ap-1', counterparty: 'Supplier X', amount: 4200, dueDate: '2026-06-12' },
  ];

  it('matches an inflow to a receivable of the same amount within the date window', () => {
    const { results, summary } = matchBankMovements(
      [
        {
          id: 'm1',
          movementDate: '2026-06-11',
          amount: 10000,
          isInflow: true,
          description: 'Wire from Customer A',
        },
      ],
      receivables,
      payables,
    );
    expect(results[0]).toMatchObject({
      movementId: 'm1',
      status: 'matched',
      matchedRecordId: 'ar-1',
      matchedCounterparty: 'Customer A',
    });
    expect(summary.matched).toBe(1);
  });

  it('flags a smaller inflow against an open receivable as a partial payment', () => {
    const { results, summary } = matchBankMovements(
      [
        {
          id: 'm2',
          movementDate: '2026-06-14',
          amount: 3000,
          isInflow: true,
          description: 'Partial wire from Customer B',
        },
      ],
      receivables,
      payables,
    );
    expect(results[0]).toMatchObject({
      movementId: 'm2',
      status: 'partial',
      matchedRecordId: 'ar-2',
      varianceAmount: 2000,
    });
    expect(summary.partial).toBe(1);
  });

  it('flags a deposit with no plausible AR/AP match as unmatched', () => {
    // Far outside the date window of every open receivable/payable, so nothing
    // is a plausible candidate regardless of amount.
    const { results, summary } = matchBankMovements(
      [
        {
          id: 'm3',
          movementDate: '2026-09-01',
          amount: 9500,
          isInflow: true,
          description: 'Insurance settlement',
        },
      ],
      receivables,
      payables,
    );
    expect(results[0].status).toBe('unmatched');
    expect(summary.unmatched).toBe(1);
    expect(summary.unmatchedInflowTotal).toBe(9500);
  });

  it('does not match the same receivable to two different movements', () => {
    const { results, summary } = matchBankMovements(
      [
        { id: 'm4', movementDate: '2026-06-09', amount: 10000, isInflow: true },
        { id: 'm5', movementDate: '2026-06-10', amount: 10000, isInflow: true },
      ],
      receivables,
      payables,
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(['matched', 'unmatched']);
    expect(summary.matched).toBe(1);
    expect(summary.unmatched).toBe(1);
  });

  it('matches outflows against payables independently of receivables', () => {
    const { results } = matchBankMovements(
      [
        {
          id: 'm6',
          movementDate: '2026-06-13',
          amount: 4200,
          isInflow: false,
          description: 'Payment to Supplier X',
        },
      ],
      receivables,
      payables,
    );
    expect(results[0]).toMatchObject({ status: 'matched', matchedRecordId: 'ap-1' });
  });

  it('excludes balance-upload rows from matching entirely', () => {
    const { results } = matchBankMovements(
      [
        {
          id: 'm7',
          movementDate: '2026-06-01',
          amount: 10000,
          isInflow: true,
          description: 'Balance upload',
        },
      ],
      receivables,
      payables,
    );
    expect(results).toHaveLength(0);
  });
});
