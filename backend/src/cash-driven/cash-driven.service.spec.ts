import { CashDrivenService } from './cash-driven.service';

const ASOF = new Date().toISOString().slice(0, 10);

function addDays(days: number): string {
  const d = new Date(`${ASOF}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fakePrisma() {
  return {
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: 'demo-ndis-care', currency: 'AUD' }),
    },
  } as never;
}

function fakeBankAccounts(accounts: Array<{ id: string; accountPurpose: string; currentBalance: number }>) {
  return {
    listForCompany: jest.fn().mockResolvedValue({
      accounts: accounts.map((a) => ({
        id: a.id,
        bankName: 'Bank',
        accountName: a.id,
        accountPurpose: a.accountPurpose,
        currentBalance: a.currentBalance,
      })),
      aggregateBalance: accounts.reduce((s, a) => s + a.currentBalance, 0),
    }),
  } as never;
}

function fakeObligations(obligations: Array<{ id: string; category: string; amount: number; nextDueDate: string }>) {
  const upcomingResult = obligations.map((o) => ({
    obligationId: o.id,
    name: o.id,
    category: o.category,
    frequency: 'monthly',
    dueDate: o.nextDueDate,
    amount: o.amount,
  }));
  const listResult = obligations.map((o) => ({
    id: o.id,
    name: o.id,
    category: o.category,
    amount: o.amount,
    frequency: 'monthly',
    nextDueDate: new Date(`${o.nextDueDate}T00:00:00.000Z`),
    active: true,
    paymentMethod: null,
    linkedBankAccountId: null,
    confidence: null,
  }));
  const nextDueDatesResult = obligations.map((o) => ({
    obligationId: o.id,
    name: o.id,
    category: o.category,
    amount: o.amount,
    dueDate: o.nextDueDate,
  }));

  return {
    upcoming: jest.fn().mockResolvedValue(upcomingResult),
    list: jest.fn().mockResolvedValue(listResult),
    nextDueDates: jest.fn().mockResolvedValue(nextDueDatesResult),
  } as never;
}

function fakeSettlements() {
  return { upcoming: jest.fn().mockResolvedValue([]) } as never;
}

describe('CashDrivenService.getDashboard', () => {
  it('marks payroll as covered when available cash meets but does not exceed 1.2x expected', async () => {
    const service = new CashDrivenService(
      fakePrisma(),
      fakeBankAccounts([{ id: 'payroll-acc', accountPurpose: 'payroll_reserve', currentBalance: 100000 }]),
      fakeObligations([{ id: 'payroll', category: 'payroll', amount: 90000, nextDueDate: addDays(4) }]),
      fakeSettlements(),
    );
    const dashboard = await service.getDashboard('demo-ndis-care');
    expect(dashboard.payrollReadiness.status).toBe('covered');
    expect(dashboard.payrollReadiness.availablePayrollCash).toBe(100000);
    expect(dashboard.payrollReadiness.bufferAfterPayroll).toBe(10000);
  });

  it('marks payroll as a shortfall when available cash is below expected', async () => {
    const service = new CashDrivenService(
      fakePrisma(),
      fakeBankAccounts([{ id: 'payroll-acc', accountPurpose: 'payroll_reserve', currentBalance: 50000 }]),
      fakeObligations([{ id: 'payroll', category: 'payroll', amount: 84200, nextDueDate: addDays(4) }]),
      fakeSettlements(),
    );
    const dashboard = await service.getDashboard('demo-ndis-care');
    expect(dashboard.payrollReadiness.status).toBe('shortfall');
  });

  it('falls back to operating cash for payroll readiness when no payroll_reserve account exists', async () => {
    const service = new CashDrivenService(
      fakePrisma(),
      fakeBankAccounts([{ id: 'op', accountPurpose: 'operating', currentBalance: 60000 }]),
      fakeObligations([{ id: 'payroll', category: 'payroll', amount: 50000, nextDueDate: addDays(2) }]),
      fakeSettlements(),
    );
    const dashboard = await service.getDashboard('demo-ndis-care');
    expect(dashboard.payrollReadiness.availablePayrollCash).toBe(60000);
    expect(dashboard.payrollReadiness.status).toBe('comfortable');
  });

  it('excludes reserve/clearing purposes from availableToSpend', async () => {
    const service = new CashDrivenService(
      fakePrisma(),
      fakeBankAccounts([
        { id: 'op', accountPurpose: 'operating', currentBalance: 82000 },
        { id: 'payroll', accountPurpose: 'payroll_reserve', currentBalance: 135000 },
        { id: 'tax', accountPurpose: 'tax_reserve', currentBalance: 47000 },
        { id: 'ndis', accountPurpose: 'ndis_settlement', currentBalance: 66000 },
      ]),
      fakeObligations([]),
      fakeSettlements(),
    );
    const dashboard = await service.getDashboard('demo-ndis-care');
    const totalCash = 82000 + 135000 + 47000 + 66000;
    expect(dashboard.cashByPurpose.totalCash).toBe(totalCash);
    // availableToSpend should exclude payroll reserve, tax reserve, and NDIS clearing funds
    expect(dashboard.cashByPurpose.availableToSpend).toBe(totalCash - 135000 - 47000 - 66000);
  });
});
