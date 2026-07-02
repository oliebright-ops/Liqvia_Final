import { Injectable, NotFoundException } from '@nestjs/common';
import {
  computeAccountLedger,
  matchBankMovements,
  ReconciliationStatus,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface BankAccountView {
  id: string;
  accountName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  status: 'active' | 'inactive';
}

export interface BankTransactionView {
  id: string;
  transactionDate: string;
  description: string;
  category: string;
  amount: number;
  direction: 'IN' | 'OUT';
  runningBalance: number;
  status: 'cleared' | 'pending';
  /**
   * Heuristic amount/date match against open AR/AP as of asOfDate — not a
   * certified reconciliation, see packages/shared/src/reconciliation.ts.
   */
  reconciliationStatus: ReconciliationStatus;
  matchedCounterparty?: string;
}

export interface BankAccountLedgerView {
  openingBalance: number;
  openingDate: string | null;
  closingBalance: number;
  transactions: BankTransactionView[];
  reconciliationSummary: {
    matched: number;
    partial: number;
    unmatched: number;
    unmatchedInflowTotal: number;
    unmatchedOutflowTotal: number;
  };
}

export interface BankAccountsSummary {
  accounts: BankAccountView[];
  aggregateBalance: number;
  aggregateOpeningBalance: number;
  currency: string;
  accountCount: number;
}

type MovementRow = {
  id: string;
  bankAccountId: string;
  movementDate: Date;
  amount: unknown;
  isInflow: boolean;
  description: string | null;
};

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCompany(companyId: string): Promise<BankAccountsSummary> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const asOfDate = new Date().toISOString().slice(0, 10);
    const [accounts, movements] = await Promise.all([
      this.prisma.bankAccount.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.cashMovement.findMany({
        where: { companyId },
        orderBy: { movementDate: 'desc' },
      }),
    ]);

    const views = accounts.map((acc) => this.toAccountView(acc, movements, asOfDate));
    const aggregateBalance = views.reduce((s, a) => s + a.currentBalance, 0);
    const aggregateOpeningBalance = views.reduce((s, a) => s + a.openingBalance, 0);

    return {
      accounts: views,
      aggregateBalance: round2(aggregateBalance),
      aggregateOpeningBalance: round2(aggregateOpeningBalance),
      currency: company.currency,
      accountCount: views.length,
    };
  }

  async getAccountLedger(
    companyId: string,
    bankAccountId: string,
    asOfDate: string,
    limit = 50,
  ): Promise<BankAccountLedgerView> {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    const [movements, receivables, payables] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where: { companyId, bankAccountId },
        orderBy: { movementDate: 'desc' },
      }),
      this.prisma.receivable.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.payable.findMany({ where: { companyId, deletedAt: null } }),
    ]);

    const ledger = computeAccountLedger(this.toLedgerInput(movements), asOfDate);

    const { results: matches, summary: reconciliationSummary } = matchBankMovements(
      this.toLedgerInput(movements).map((m) => ({
        id: m.id,
        movementDate: m.movementDate,
        amount: m.amount,
        isInflow: m.isInflow,
        description: m.description,
      })),
      receivables.map((r) => ({
        id: r.id,
        counterparty: r.customerName,
        amount: Number(r.outstandingAmount),
        dueDate: r.dueDate.toISOString().slice(0, 10),
      })),
      payables.map((p) => ({
        id: p.id,
        counterparty: p.supplierName,
        amount: Number(p.outstandingAmount),
        dueDate: p.dueDate.toISOString().slice(0, 10),
      })),
    );
    const matchByMovementId = new Map(matches.map((m) => [m.movementId, m]));

    const transactions = ledger.transactions.slice(-limit).map((t) => {
      const match = matchByMovementId.get(t.id);
      return {
        ...t,
        status: txnStatus(t.transactionDate, asOfDate),
        reconciliationStatus: match?.status ?? 'unmatched',
        matchedCounterparty: match?.matchedCounterparty,
      };
    });

    return {
      openingBalance: ledger.openingBalance,
      openingDate: ledger.openingDate,
      closingBalance: ledger.closingBalance,
      transactions,
      reconciliationSummary,
    };
  }

  private toAccountView(
    acc: { id: string; name: string; accountNumberMasked: string; currency: string },
    movements: MovementRow[],
    asOfDate: string,
  ): BankAccountView {
    const accountMovements = movements.filter((m) => m.bankAccountId === acc.id);
    const ledger = computeAccountLedger(this.toLedgerInput(accountMovements), asOfDate);
    const { accountName, bankName } = splitAccountName(acc.name);

    return {
      id: acc.id,
      accountName,
      bankName,
      accountNumberMasked: acc.accountNumberMasked,
      currency: acc.currency,
      openingBalance: ledger.openingBalance,
      currentBalance: ledger.closingBalance,
      status: 'active',
    };
  }

  private toLedgerInput(movements: MovementRow[]) {
    return movements.map((m) => ({
      id: m.id,
      bankAccountId: m.bankAccountId,
      movementDate: m.movementDate.toISOString(),
      amount: Number(m.amount),
      isInflow: m.isInflow,
      description: m.description,
    }));
  }
}

function splitAccountName(name: string): { accountName: string; bankName: string } {
  const parts = name.split(' — ');
  if (parts.length >= 2) {
    return { bankName: parts[0].trim(), accountName: parts.slice(1).join(' — ').trim() };
  }
  const dash = name.split(' - ');
  if (dash.length >= 2) {
    return { bankName: dash[0].trim(), accountName: dash.slice(1).join(' - ').trim() };
  }
  return { bankName: 'Bank', accountName: name };
}

function txnStatus(transactionDate: string, asOfDate: string): 'cleared' | 'pending' {
  return daysBetween(transactionDate, asOfDate) <= 3 ? 'pending' : 'cleared';
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
