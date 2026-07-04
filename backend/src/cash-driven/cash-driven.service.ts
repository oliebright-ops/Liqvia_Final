import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { RecurringObligationsService } from '../recurring-obligations/recurring-obligations.service';
import { ExpectedSettlementsService } from '../expected-settlements/expected-settlements.service';

/** Reserve-type purposes: money set aside for a known future use, not free operating cash. */
const RESERVE_PURPOSES: AccountPurpose[] = [
  'payroll_reserve',
  'tax_reserve',
  'emergency_reserve',
  'loan_offset',
  'project_funds',
];

/** In-transit settlement funds sitting in a clearing/merchant account, not yet available to spend. */
const CLEARING_PURPOSES: AccountPurpose[] = ['merchant_clearing', 'amex_settlement', 'ndis_settlement'];

const WEEKLY_MOVEMENT_WEEKS = 8;
/** Window used to size "known upcoming obligations" reserved out of available-to-spend cash. */
const KNOWN_OBLIGATIONS_WINDOW_DAYS = 30;

export type PayrollReadinessStatus = 'comfortable' | 'covered' | 'shortfall';

export interface PayrollReadinessView {
  nextPayrollDate: string | null;
  expectedPayrollAmount: number;
  availablePayrollCash: number;
  bufferAfterPayroll: number;
  status: PayrollReadinessStatus | null;
}

export interface UpcomingObligationOccurrenceView {
  obligationId: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  nextDueDate: string;
  paymentMethod: string | null;
  linkedBankAccount: string | null;
  confidence: string | null;
}

export interface SettlementOccurrenceView {
  settlementId: string;
  source: string;
  expectedAmount: number;
  expectedDate: string;
  destinationAccount: string | null;
  status: string;
  confidence: string | null;
}

export interface WeeklyCashMovementView {
  weekIndex: number;
  weekStartDate: string;
  openingCash: number;
  expectedIncoming: number;
  expectedOutgoing: number;
  closingCash: number;
  netMovement: number;
}

export interface CashByPurposeView {
  totalCash: number;
  currency: string;
  payrollReserve: number;
  taxReserve: number;
  emergencyReserve: number;
  /** In-transit funds sitting in merchant/Amex/NDIS-style clearing accounts, not yet spendable. */
  restrictedOrClearingFunds: number;
  /** Other reserved purposes (loan offset, project funds) excluded from spendable cash but not shown as their own line. */
  otherReserved: number;
  knownUpcomingObligations: number;
  availableToSpend: number;
  byPurpose: Record<AccountPurpose, number>;
}

export interface CashDrivenDashboardView {
  payrollReadiness: PayrollReadinessView;
  upcomingObligations: UpcomingObligationOccurrenceView[];
  settlementTimeline: SettlementOccurrenceView[];
  weeklyCashMovement: WeeklyCashMovementView[];
  cashByPurpose: CashByPurposeView;
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CashDrivenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankAccounts: BankAccountsService,
    private readonly obligations: RecurringObligationsService,
    private readonly settlements: ExpectedSettlementsService,
  ) {}

  async getDashboard(companyId: string): Promise<CashDrivenDashboardView> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const asOfDate = new Date().toISOString().slice(0, 10);
    const horizonEndDate = addDaysIso(asOfDate, WEEKLY_MOVEMENT_WEEKS * 7);

    const [accountsSummary, obligationOccurrences, settlementOccurrences] = await Promise.all([
      this.bankAccounts.listForCompany(companyId),
      this.obligations.upcoming(companyId, asOfDate, horizonEndDate),
      this.settlements.upcoming(companyId, asOfDate, horizonEndDate),
    ]);

    const accountNameById = new Map(
      accountsSummary.accounts.map((a) => [a.id, `${a.bankName} — ${a.accountName}`]),
    );

    const payrollReadiness = await this.buildPayrollReadiness(companyId, asOfDate, accountsSummary);
    const upcomingObligations = await this.buildUpcomingObligations(companyId, asOfDate, accountNameById);
    const settlementTimeline = settlementOccurrences
      .slice()
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
      .map((s) => ({
        settlementId: s.settlementId,
        source: s.source,
        expectedAmount: s.amount,
        expectedDate: s.expectedDate,
        destinationAccount: s.destinationAccountId
          ? accountNameById.get(s.destinationAccountId) ?? null
          : null,
        status: s.status,
        confidence: s.confidence,
      }));

    const weeklyCashMovement = this.buildWeeklyCashMovement(
      accountsSummary.aggregateBalance,
      asOfDate,
      obligationOccurrences,
      settlementOccurrences,
    );

    const cashByPurpose = this.buildCashByPurpose(
      accountsSummary,
      company.currency,
      await this.obligations.list(companyId),
      asOfDate,
    );

    return {
      payrollReadiness,
      upcomingObligations,
      settlementTimeline,
      weeklyCashMovement,
      cashByPurpose,
    };
  }

  private async buildPayrollReadiness(
    companyId: string,
    asOfDate: string,
    accountsSummary: Awaited<ReturnType<BankAccountsService['listForCompany']>>,
  ): Promise<PayrollReadinessView> {
    const nextDueDates = await this.obligations.nextDueDates(companyId, asOfDate);
    const payrollObligations = nextDueDates.filter((o) => o.category === 'payroll');

    const payrollReserveBalance = accountsSummary.accounts
      .filter((a) => a.accountPurpose === 'payroll_reserve')
      .reduce((s, a) => s + a.currentBalance, 0);
    const operatingBalance = accountsSummary.accounts
      .filter((a) => a.accountPurpose === 'operating')
      .reduce((s, a) => s + a.currentBalance, 0);
    // Businesses without a dedicated payroll reserve account fund payroll from operating cash.
    const availablePayrollCash = payrollReserveBalance > 0 ? payrollReserveBalance : operatingBalance;

    if (payrollObligations.length === 0) {
      return {
        nextPayrollDate: null,
        expectedPayrollAmount: 0,
        availablePayrollCash,
        bufferAfterPayroll: availablePayrollCash,
        status: null,
      };
    }

    const next = payrollObligations.reduce((soonest, o) =>
      o.dueDate < soonest.dueDate ? o : soonest,
    );
    const bufferAfterPayroll = availablePayrollCash - next.amount;
    const status: PayrollReadinessStatus =
      availablePayrollCash >= next.amount * 1.2
        ? 'comfortable'
        : availablePayrollCash >= next.amount
          ? 'covered'
          : 'shortfall';

    return {
      nextPayrollDate: next.dueDate,
      expectedPayrollAmount: next.amount,
      availablePayrollCash,
      bufferAfterPayroll,
      status,
    };
  }

  private async buildUpcomingObligations(
    companyId: string,
    asOfDate: string,
    accountNameById: Map<string, string>,
  ): Promise<UpcomingObligationOccurrenceView[]> {
    const obligations = await this.obligations.list(companyId);
    const nextDueDates = await this.obligations.nextDueDates(companyId, asOfDate);
    const dueDateById = new Map(nextDueDates.map((d) => [d.obligationId, d.dueDate]));

    return obligations
      .map((o) => ({
        obligationId: o.id,
        name: o.name,
        category: o.category,
        amount: Number(o.amount),
        frequency: o.frequency,
        nextDueDate: dueDateById.get(o.id) ?? o.nextDueDate.toISOString().slice(0, 10),
        paymentMethod: o.paymentMethod,
        linkedBankAccount: o.linkedBankAccountId
          ? accountNameById.get(o.linkedBankAccountId) ?? null
          : null,
        confidence: o.confidence,
      }))
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }

  private buildWeeklyCashMovement(
    startingCash: number,
    asOfDate: string,
    obligationOccurrences: Array<{ dueDate: string; amount: number }>,
    settlementOccurrences: Array<{ expectedDate: string; amount: number }>,
  ): WeeklyCashMovementView[] {
    const weeks: WeeklyCashMovementView[] = [];
    let openingCash = startingCash;

    for (let weekIndex = 0; weekIndex < WEEKLY_MOVEMENT_WEEKS; weekIndex += 1) {
      const weekStartDate = addDaysIso(asOfDate, weekIndex * 7);
      const weekEndDate = addDaysIso(asOfDate, (weekIndex + 1) * 7 - 1);

      const expectedIncoming = settlementOccurrences
        .filter((s) => s.expectedDate >= weekStartDate && s.expectedDate <= weekEndDate)
        .reduce((sum, s) => sum + s.amount, 0);
      const expectedOutgoing = obligationOccurrences
        .filter((o) => o.dueDate >= weekStartDate && o.dueDate <= weekEndDate)
        .reduce((sum, o) => sum + o.amount, 0);

      const netMovement = expectedIncoming - expectedOutgoing;
      const closingCash = openingCash + netMovement;

      weeks.push({
        weekIndex,
        weekStartDate,
        openingCash,
        expectedIncoming,
        expectedOutgoing,
        closingCash,
        netMovement,
      });

      openingCash = closingCash;
    }

    return weeks;
  }

  private buildCashByPurpose(
    accountsSummary: Awaited<ReturnType<BankAccountsService['listForCompany']>>,
    currency: string,
    obligations: Array<{ amount: unknown; nextDueDate: Date; frequency: string; active: boolean }>,
    asOfDate: string,
  ): CashByPurposeView {
    const byPurpose = accountsSummary.accounts.reduce(
      (acc, a) => {
        acc[a.accountPurpose] = (acc[a.accountPurpose] ?? 0) + a.currentBalance;
        return acc;
      },
      {} as Record<AccountPurpose, number>,
    );

    const sumPurposes = (purposes: AccountPurpose[]) =>
      purposes.reduce((s, p) => s + (byPurpose[p] ?? 0), 0);

    const payrollReserve = byPurpose.payroll_reserve ?? 0;
    const taxReserve = byPurpose.tax_reserve ?? 0;
    const emergencyReserve = byPurpose.emergency_reserve ?? 0;
    const restrictedOrClearingFunds = sumPurposes(CLEARING_PURPOSES);
    const otherReserved = sumPurposes(
      RESERVE_PURPOSES.filter((p) => p !== 'payroll_reserve' && p !== 'tax_reserve' && p !== 'emergency_reserve'),
    );

    const knownUpcomingWindowEnd = addDaysIso(asOfDate, KNOWN_OBLIGATIONS_WINDOW_DAYS);
    const knownUpcomingObligations = obligations
      .filter((o) => o.active)
      .reduce((sum, o) => {
        const dueDate = o.nextDueDate.toISOString().slice(0, 10);
        return dueDate >= asOfDate && dueDate <= knownUpcomingWindowEnd ? sum + Number(o.amount) : sum;
      }, 0);

    const totalCash = accountsSummary.aggregateBalance;
    const availableToSpend =
      totalCash -
      payrollReserve -
      taxReserve -
      emergencyReserve -
      otherReserved -
      restrictedOrClearingFunds -
      knownUpcomingObligations;

    return {
      totalCash,
      currency,
      payrollReserve,
      taxReserve,
      emergencyReserve,
      restrictedOrClearingFunds,
      otherReserved,
      knownUpcomingObligations,
      availableToSpend,
      byPurpose,
    };
  }
}
