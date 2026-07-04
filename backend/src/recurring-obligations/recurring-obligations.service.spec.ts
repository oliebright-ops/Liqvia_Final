import { priorityForCategory, RecurringObligationsService } from './recurring-obligations.service';

function fakePrisma(obligations: Array<Record<string, unknown>>) {
  return {
    recurringObligation: {
      findMany: jest.fn().mockResolvedValue(obligations),
    },
  } as never;
}

describe('priorityForCategory', () => {
  it('maps payroll to payroll priority', () => {
    expect(priorityForCategory('payroll')).toBe('payroll');
  });

  it('maps tax-like categories (super, PAYG, GST/BAS) to tax priority', () => {
    expect(priorityForCategory('superannuation')).toBe('tax');
    expect(priorityForCategory('payg_withholding')).toBe('tax');
    expect(priorityForCategory('gst_bas')).toBe('tax');
  });

  it('maps rent and loan repayments to critical priority', () => {
    expect(priorityForCategory('rent')).toBe('critical');
    expect(priorityForCategory('loan_repayment')).toBe('critical');
  });

  it('maps insurance to flexible and subscriptions to non_essential', () => {
    expect(priorityForCategory('insurance')).toBe('flexible');
    expect(priorityForCategory('subscription')).toBe('non_essential');
  });
});

describe('RecurringObligationsService.asSyntheticPayables', () => {
  it('projects each obligation into synthetic payable rows carrying its mapped priority', async () => {
    const service = new RecurringObligationsService(
      fakePrisma([
        {
          id: 'ob-1',
          name: 'Payroll run',
          category: 'payroll',
          amount: '25000',
          frequency: 'fortnightly',
          nextDueDate: new Date('2026-07-10T00:00:00.000Z'),
        },
      ]),
    );

    const rows = await service.asSyntheticPayables('company-1', '2026-07-04', '2026-07-31');

    expect(rows).toHaveLength(2); // 07-10 and 07-24 fall within the horizon
    expect(rows[0]).toMatchObject({
      counterparty: 'Payroll run',
      outstandingAmount: 25000,
      dueDate: '2026-07-10',
      supplierPriority: 'payroll',
    });
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('excludes inactive/soft-deleted obligations via the query filter', async () => {
    const prisma = fakePrisma([]);
    const service = new RecurringObligationsService(prisma);

    await service.asSyntheticPayables('company-1', '2026-07-04', '2026-07-31');

    expect(
      (prisma as unknown as { recurringObligation: { findMany: jest.Mock } }).recurringObligation
        .findMany,
    ).toHaveBeenCalledWith({
      where: { companyId: 'company-1', deletedAt: null, active: true },
    });
  });
});
