import { Injectable } from '@nestjs/common';
import {
  categorizeTransaction,
  computeAccountLedger,
  DEFAULT_DEMO_COMPANY_ID,
  isBalanceAnchor,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { TreasuryAiContext, analyzeUserQuery, buildTreasuryContext } from './ai-context';

@Injectable()
export class AiDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  async buildContext(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    userQuestion?: string,
    explicitIntent?: string,
  ): Promise<TreasuryAiContext> {
    const [dashboard, bankAccounts, movements, weeklyActualRows] = await Promise.all([
      this.dashboard.getDashboard(companyId),
      this.prisma.bankAccount.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.cashMovement.findMany({
        where: { companyId },
        orderBy: { movementDate: 'desc' },
        take: 200,
      }),
      this.prisma.weeklyActual.findMany({
        where: { companyId },
        orderBy: [{ period: 'desc' }, { category: 'asc' }],
        take: 40,
      }),
    ]);

    const accountById = new Map(bankAccounts.map((a) => [a.id, a]));
    const asOfDate = dashboard.asOfDate;

    const bankAccountSummaries = bankAccounts.map((account) => {
      const accountMovements = movements
        .filter((m) => m.bankAccountId === account.id)
        .map((m) => ({
          id: m.id,
          bankAccountId: m.bankAccountId,
          movementDate: m.movementDate.toISOString(),
          amount: Number(m.amount),
          isInflow: m.isInflow,
          description: m.description,
        }));
      const ledger = computeAccountLedger(accountMovements, asOfDate);
      return {
        name: account.name,
        currency: account.currency,
        balance: ledger.closingBalance,
      };
    });

    const cashTransactions = movements
      .filter((m) => !isBalanceAnchor(m.description))
      .map((m) => {
        const account = accountById.get(m.bankAccountId);
        const date = m.movementDate.toISOString().slice(0, 10);
        return {
          id: m.id,
          date,
          description: m.description?.trim() || (m.isInflow ? 'Inflow' : 'Outflow'),
          category: categorizeTransaction(m.description),
          amount: Number(m.amount),
          direction: m.isInflow ? ('IN' as const) : ('OUT' as const),
          accountName: account?.name ?? 'Unknown account',
        };
      });

    const recentOutflows = cashTransactions.filter((t) => t.direction === 'OUT').slice(0, 40);

    const recentInflows = cashTransactions.filter((t) => t.direction === 'IN').slice(0, 20);

    const receivablesDetail =
      dashboard.kpis.overdueReceivables >= 0
        ? (
            await this.prisma.receivable.findMany({
              where: { companyId, deletedAt: null },
              orderBy: { dueDate: 'asc' },
              take: 30,
            })
          ).map((r) => {
            const dueDate = r.dueDate.toISOString().slice(0, 10);
            const daysOverdue =
              dueDate < asOfDate
                ? Math.floor(
                    (new Date(asOfDate).getTime() - new Date(dueDate).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : 0;
            return {
              counterparty: r.customerName,
              amount: Number(r.outstandingAmount),
              invoiceDate: r.invoiceDate.toISOString().slice(0, 10),
              dueDate,
              daysOverdue,
              status: daysOverdue > 0 ? 'overdue' : 'open',
            };
          })
        : [];

    const payablesDetail = (
      await this.prisma.payable.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { dueDate: 'asc' },
        take: 30,
      })
    ).map((p) => {
      const dueDate = p.dueDate.toISOString().slice(0, 10);
      const daysOverdue =
        dueDate < asOfDate
          ? Math.floor(
              (new Date(asOfDate).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;
      return {
        counterparty: p.supplierName,
        amount: Number(p.outstandingAmount),
        billDate: p.billDate.toISOString().slice(0, 10),
        dueDate,
        daysOverdue,
        status: daysOverdue > 0 ? 'overdue' : 'open',
        supplierPriority: p.supplierPriority,
      };
    });

    const budgetLines = dashboard.budgetVsActual.lines
      .slice()
      .sort((a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount))
      .slice(0, 25)
      .map((l) => ({
        period: l.period,
        category: l.category,
        budgetAmount: l.budgetAmount,
        actualAmount: l.actualAmount,
        varianceAmount: l.varianceAmount,
        variancePercent: l.variancePercent,
      }));

    const forecastWeeks = dashboard.forecast.map((w) => ({
      weekStart: w.weekStart,
      weekIndex: w.weekIndex,
      openingCash: w.openingCash,
      inflows: w.forecastInflows,
      outflows: w.forecastOutflows,
      closingCash: w.closingCash,
    }));

    const base = buildTreasuryContext(dashboard);
    const enriched: TreasuryAiContext = {
      ...base,
      bankAccounts: bankAccountSummaries,
      cashTransactions: cashTransactions.slice(0, 80),
      recentOutflows,
      recentInflows,
      receivablesDetail,
      payablesDetail,
      budgetLines,
      forecastWeeks,
      weeklyActuals: weeklyActualRows.map((a) => ({
        period: a.period,
        category: a.category,
        amount: Number(a.actualAmount),
      })),
      dataModules: {
        bankTransactions: cashTransactions.length,
        receivables: receivablesDetail.length,
        payables: payablesDetail.length,
        budgetLines: budgetLines.length,
        forecastWeeks: forecastWeeks.length,
      },
    };

    if (userQuestion?.trim()) {
      enriched.queryAnalysis = analyzeUserQuery(userQuestion, enriched, explicitIntent);
    }

    return enriched;
  }
}
