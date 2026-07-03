import { Injectable } from '@nestjs/common';
import { UploadBatchStatus, UploadTemplateType } from '@prisma/client';
import { getFutureWeekPeriods, getPastWeekPeriods, UPLOAD_TEMPLATES } from '@liqvia2/shared';
import type { UploadTemplateType as SharedUploadTemplateType } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface ActiveUploadData {
  templateType: UploadTemplateType;
  rowCount: number;
  headers: readonly string[];
  rows: Record<string, unknown>[];
  source: 'live';
}

@Injectable()
export class UploadActiveDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveData(
    companyId: string,
    templateType: UploadTemplateType,
  ): Promise<ActiveUploadData> {
    const headers =
      templateType in UPLOAD_TEMPLATES
        ? UPLOAD_TEMPLATES[templateType as SharedUploadTemplateType].headers
        : [];
    const asOfDate = new Date().toISOString().slice(0, 10);

    let rows: Record<string, unknown>[] = [];

    switch (templateType) {
      case 'trial_balance':
        rows = await this.exportTrialBalance(companyId);
        break;
      case 'weekly_actuals':
        rows = await this.exportWeeklyActuals(companyId);
        break;
      case 'prior_period_budget':
        rows = await this.exportPriorBudget(companyId, asOfDate);
        break;
      case 'rolling_budget':
        rows = await this.exportRollingBudget(companyId, asOfDate);
        break;
      case 'budget':
        rows = await this.exportPriorBudget(companyId, asOfDate);
        break;
      case 'ar_ageing':
        rows = await this.exportReceivables(companyId);
        break;
      case 'ap_ageing':
        rows = await this.exportPayables(companyId);
        break;
      case 'bank_balances':
        rows = await this.exportBankBalances(companyId);
        break;
      case 'bank_transactions':
        rows = await this.exportBankTransactions(companyId);
        break;
      default:
        rows = [];
    }

    return {
      templateType,
      rowCount: rows.length,
      headers,
      rows,
      source: 'live',
    };
  }

  private async exportTrialBalance(companyId: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntry: { companyId } },
      include: { chartOfAccount: true, journalEntry: true },
    });
    lines.sort((a, b) => {
      const periodCmp = a.journalEntry.period.localeCompare(b.journalEntry.period);
      if (periodCmp !== 0) return periodCmp;
      return a.chartOfAccount.code.localeCompare(b.chartOfAccount.code);
    });

    return lines.map((l) => ({
      Period: l.journalEntry.period,
      'Account Code': l.chartOfAccount.code,
      'Account Name': l.chartOfAccount.name,
      'Account Type': l.chartOfAccount.accountType,
      Debit: Number(l.debit),
      Credit: Number(l.credit),
    }));
  }

  private async exportWeeklyActuals(companyId: string) {
    const rows = await this.prisma.weeklyActual.findMany({
      where: { companyId },
      orderBy: [{ period: 'asc' }, { category: 'asc' }],
    });
    return rows.map((r) => ({
      Period: r.period,
      Category: r.category,
      'Account Code': r.accountCode ?? '',
      'Actual Amount': Number(r.actualAmount),
    }));
  }

  private async exportPriorBudget(companyId: string, asOfDate: string) {
    const pastPeriods = getPastWeekPeriods(asOfDate);
    const lines = await this.prisma.budgetLine.findMany({
      where: {
        budget: { companyId },
        period: { in: pastPeriods },
        budgetType: { in: ['prior', 'operating'] },
      },
      include: { chartOfAccount: true },
      orderBy: [{ period: 'asc' }, { category: 'asc' }],
    });
    return lines.map((l) => ({
      Period: l.period,
      Category: l.category,
      'Account Code': l.chartOfAccount?.code ?? '',
      'Budget Amount': Number(l.budgetAmount),
    }));
  }

  private async exportRollingBudget(companyId: string, asOfDate: string) {
    const futurePeriods = getFutureWeekPeriods(asOfDate);
    const lines = await this.prisma.budgetLine.findMany({
      where: {
        budget: { companyId },
        period: { in: futurePeriods },
        budgetType: { in: ['rolling', 'rolling_auto'] },
      },
      include: { chartOfAccount: true },
      orderBy: [{ period: 'asc' }, { category: 'asc' }],
    });
    return this.dedupeRollingBudget(lines).map((l) => ({
      Period: l.period,
      Category: l.category,
      'Account Code': l.chartOfAccount?.code ?? '',
      'Budget Amount': Number(l.budgetAmount),
    }));
  }

  /**
   * An explicit rolling_budget.csv upload (budgetType 'rolling') is never cleaned up
   * against the system's auto-generated 'rolling_auto' fallback for the same
   * period/category/account (see syncRollingBudgetIfNeeded in upload-import.service.ts),
   * so both can coexist. Prefer the explicit upload when both exist.
   */
  private dedupeRollingBudget<
    T extends { period: string; category: string; budgetType: string; chartOfAccount?: { code: string } | null },
  >(lines: T[]): T[] {
    const byKey = new Map<string, T>();
    for (const line of lines) {
      const key = `${line.period}::${line.category}::${line.chartOfAccount?.code ?? ''}`;
      const existing = byKey.get(key);
      if (!existing || (existing.budgetType === 'rolling_auto' && line.budgetType === 'rolling')) {
        byKey.set(key, line);
      }
    }
    return Array.from(byKey.values());
  }

  private async exportReceivables(companyId: string) {
    const rows = await this.prisma.receivable.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { dueDate: 'asc' },
    });
    return rows.map((r) => ({
      'Customer Name': r.customerName,
      'Invoice Number': r.invoiceNumber,
      'Invoice Date': r.invoiceDate.toISOString().slice(0, 10),
      'Due Date': r.dueDate.toISOString().slice(0, 10),
      'Outstanding Amount': Number(r.outstandingAmount),
      Currency: r.currency,
    }));
  }

  private async exportPayables(companyId: string) {
    const rows = await this.prisma.payable.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { dueDate: 'asc' },
    });
    return rows.map((p) => ({
      'Supplier Name': p.supplierName,
      'Bill Number': p.billNumber,
      'Bill Date': p.billDate.toISOString().slice(0, 10),
      'Due Date': p.dueDate.toISOString().slice(0, 10),
      'Outstanding Amount': Number(p.outstandingAmount),
      'Supplier Priority': p.supplierPriority,
      Currency: p.currency,
    }));
  }

  private async exportBankBalances(companyId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { companyId, deletedAt: null },
    });
    const movements = await this.prisma.cashMovement.findMany({
      where: { companyId, description: 'Balance upload' },
      orderBy: { movementDate: 'desc' },
    });

    const rows: Record<string, unknown>[] = [];
    for (const account of accounts) {
      const latest = movements.find((m) => m.bankAccountId === account.id);
      if (!latest) continue;
      rows.push({
        'Bank Account Name': account.name,
        'Account Number Masked': account.accountNumberMasked,
        Currency: account.currency,
        'Balance Date': latest.movementDate.toISOString().slice(0, 10),
        'Current Balance': Number(latest.amount),
      });
    }
    return rows;
  }

  private async exportBankTransactions(companyId: string) {
    const movements = await this.prisma.cashMovement.findMany({
      where: {
        companyId,
        description: { notIn: ['Balance upload', 'Opening cash balance'] },
      },
      include: { bankAccount: true },
      orderBy: { movementDate: 'desc' },
    });
    return movements.map((m) => ({
      'Bank Account Name': m.bankAccount.name,
      'Account Number Masked': m.bankAccount.accountNumberMasked,
      'Transaction Date': m.movementDate.toISOString().slice(0, 10),
      Description: m.description,
      Amount: Number(m.amount),
      Direction: m.isInflow ? 'IN' : 'OUT',
    }));
  }
}
