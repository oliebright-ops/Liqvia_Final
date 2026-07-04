import { Injectable } from '@nestjs/common';
import {
  categorizeTransaction,
  computeAccountLedger,
  DEFAULT_DEMO_COMPANY_ID,
  isBalanceAnchor,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { RecurringObligationsService } from '../recurring-obligations/recurring-obligations.service';
import { DataQualityService } from '../data-quality/data-quality.service';
import { CashDrivenService } from '../cash-driven/cash-driven.service';
import { TreasuryAiContext, analyzeUserQuery, buildTreasuryContext } from './ai-context';

function addMonthsIso(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AiDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly recurringObligations: RecurringObligationsService,
    private readonly dataQuality: DataQualityService,
    private readonly cashDriven: CashDrivenService,
  ) {}

  async buildContext(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    userQuestion?: string,
    explicitIntent?: string,
  ): Promise<TreasuryAiContext> {
    const queryAsOfDate = new Date().toISOString().slice(0, 10);
    const [company, dashboard, bankAccounts, movements, weeklyActualRows, upcomingObligations, dataQualityReport] =
      await Promise.all([
        this.prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
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
        this.recurringObligations.upcoming(
          companyId,
          queryAsOfDate,
          addMonthsIso(queryAsOfDate, 3),
        ),
        this.dataQuality.getReport(companyId),
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
        accountPurpose: account.accountPurpose,
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

    const receivablesDetail = (
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
              (new Date(asOfDate).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24),
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
    });

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

    const obligationRecords = await this.recurringObligations.list(companyId);
    const obligationById = new Map(obligationRecords.map((o) => [o.id, o]));
    const accountNameById = new Map(bankAccounts.map((a) => [a.id, a.name]));

    const base = buildTreasuryContext(dashboard);
    const enriched: TreasuryAiContext = {
      ...base,
      businessMode: company.businessMode,
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
      recurringObligations: upcomingObligations.map((o) => {
        const record = obligationById.get(o.obligationId);
        return {
          name: o.name,
          category: o.category,
          amount: o.amount,
          frequency: o.frequency,
          dueDate: o.dueDate,
          paymentMethod: record?.paymentMethod ?? null,
          linkedBankAccount: record?.linkedBankAccountId
            ? accountNameById.get(record.linkedBankAccountId) ?? null
            : null,
          confidence: record?.confidence ?? null,
        };
      }),
      dataQuality: {
        score: dataQualityReport.score,
        warnings: dataQualityReport.warnings,
      },
      dataModules: {
        bankTransactions: cashTransactions.length,
        receivables: receivablesDetail.length,
        payables: payablesDetail.length,
        budgetLines: budgetLines.length,
        forecastWeeks: forecastWeeks.length,
      },
    };

    if (company.businessMode === 'cash_driven' || company.businessMode === 'mixed') {
      const cashDrivenDashboard = await this.cashDriven.getDashboard(companyId);
      enriched.payrollReadiness = cashDrivenDashboard.payrollReadiness;
      enriched.settlementTimeline = cashDrivenDashboard.settlementTimeline.map((s) => ({
        source: s.source,
        expectedAmount: s.expectedAmount,
        expectedDate: s.expectedDate,
        destinationAccount: s.destinationAccount,
        status: s.status,
        confidence: s.confidence,
      }));
      enriched.cashByPurpose = {
        totalCash: cashDrivenDashboard.cashByPurpose.totalCash,
        payrollReserve: cashDrivenDashboard.cashByPurpose.payrollReserve,
        taxReserve: cashDrivenDashboard.cashByPurpose.taxReserve,
        emergencyReserve: cashDrivenDashboard.cashByPurpose.emergencyReserve,
        restrictedOrClearingFunds: cashDrivenDashboard.cashByPurpose.restrictedOrClearingFunds,
        knownUpcomingObligations: cashDrivenDashboard.cashByPurpose.knownUpcomingObligations,
        availableToSpend: cashDrivenDashboard.cashByPurpose.availableToSpend,
      };
      enriched.weeklyCashMovement = cashDrivenDashboard.weeklyCashMovement.map((w) => ({
        weekStartDate: w.weekStartDate,
        openingCash: w.openingCash,
        expectedIncoming: w.expectedIncoming,
        expectedOutgoing: w.expectedOutgoing,
        closingCash: w.closingCash,
        netMovement: w.netMovement,
      }));
    }

    if (userQuestion?.trim()) {
      enriched.queryAnalysis = analyzeUserQuery(userQuestion, enriched, explicitIntent);
    }

    return enriched;
  }
}
