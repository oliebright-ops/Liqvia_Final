import { computeAccountLedger } from '@liqvia2/shared';

describe('computeAccountLedger', () => {
  it('reconciles opening balance with transactions to closing balance', () => {
    const result = computeAccountLedger([
      {
        id: '1',
        movementDate: '2026-01-01T00:00:00.000Z',
        amount: 50000,
        isInflow: true,
        description: 'Balance upload',
      },
      {
        id: '2',
        movementDate: '2026-01-05T00:00:00.000Z',
        amount: 15000,
        isInflow: true,
        description: 'Customer payment',
      },
      {
        id: '3',
        movementDate: '2026-01-08T00:00:00.000Z',
        amount: 11000,
        isInflow: false,
        description: 'Payroll',
      },
    ]);

    expect(result.openingBalance).toBe(50000);
    expect(result.closingBalance).toBe(54000);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[1].runningBalance).toBe(54000);
  });

  it('sums closing balances across multiple accounts', () => {
    const accountA = computeAccountLedger([
      {
        id: 'a1',
        movementDate: '2026-01-31T00:00:00.000Z',
        amount: 48500,
        isInflow: true,
        description: 'Balance upload',
      },
    ]);
    const accountB = computeAccountLedger([
      {
        id: 'b1',
        movementDate: '2026-01-31T00:00:00.000Z',
        amount: 12000,
        isInflow: true,
        description: 'Balance upload',
      },
    ]);
    expect(accountA.closingBalance + accountB.closingBalance).toBe(60500);
  });
});
