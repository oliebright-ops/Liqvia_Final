import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildTreasurySummary,
  computeAccountLedger,
  DEFAULT_DEMO_COMPANY_ID,
  SummaryReport,
  TreasuryRawSnapshot,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetService } from '../budget/budget.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { TreasuryKpiService } from '../treasury/treasury-kpi.service';

/**
 * Unified Treasury Data Controller (server-side).
 * Fetches all entities in a single Promise.all and computes SummaryReport once.
 */
@Injectable()
export class TreasuryDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: TreasuryEngineService,
    private readonly kpis: TreasuryKpiService,
    private readonly budget: BudgetService,
  ) {}

  async getSummaryReport(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    horizonWeeksOverride?: number,
  ): Promise<SummaryReport> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(
        `Company not found: ${companyId}. Run: pnpm --filter @liqvia2/backend run prisma:seed:demo`,
      );
    }

    const horizonWeeks = horizonWeeksOverride ?? company.forecastHorizonWeeks;
    const engineResult = await this.engine.generateForCompany(companyId, false, horizonWeeks);
    const asOfDate = engineResult.asOfDate;

    const [
      bankAccounts,
      movements,
      receivables,
      payables,
      budgetVsActual,
      scenarioCount,
      weeklyActuals,
    ] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.cashMovement.findMany({
        where: { companyId },
        orderBy: { movementDate: 'desc' },
      }),
      this.prisma.receivable.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.payable.findMany({ where: { companyId, deletedAt: null } }),
      this.budget.getBudgetVsActual(companyId),
      this.prisma.scenario.count({ where: { companyId } }),
      this.prisma.weeklyActual.findMany({ where: { companyId } }),
    ]);

    const balances = bankAccounts.map((b) => {
      const accountMovements = movements
        .filter((m) => m.bankAccountId === b.id)
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
        balance: ledger.closingBalance,
        balanceDate: asOfDate,
      };
    });

    const movementInputs = movements.map((m) => ({
      id: m.id,
      bankAccountId: m.bankAccountId,
      movementDate: m.movementDate.toISOString(),
      amount: Number(m.amount),
      isInflow: m.isInflow,
      description: m.description,
    }));

    const receivableInputs = receivables.map((r) => ({
      id: r.id,
      counterparty: r.customerName,
      outstandingAmount: Number(r.outstandingAmount),
      invoiceDate: r.invoiceDate.toISOString().slice(0, 10),
      dueDate: r.dueDate.toISOString().slice(0, 10),
    }));

    const payableInputs = payables.map((p) => ({
      id: p.id,
      counterparty: p.supplierName,
      outstandingAmount: Number(p.outstandingAmount),
      billDate: p.billDate.toISOString().slice(0, 10),
      dueDate: p.dueDate.toISOString().slice(0, 10),
      supplierPriority: p.supplierPriority,
    }));

    const currentCash = this.kpis.calculateCurrentCash(balances);

    const kpis = this.kpis.buildDashboard({
      currency: company.currency,
      asOfDate,
      bankBalances: balances,
      forecastLines: engineResult.forecastLines.map((l) => ({
        weekIndex: l.weekIndex,
        closingCash: l.closingCash,
      })),
      weeklyCashFlows: engineResult.forecastLines.map((l) => ({
        weekStart: l.weekStart,
        inflows: l.forecastInflows,
        outflows: l.forecastOutflows,
      })),
      receivables: receivableInputs,
      payables: payableInputs,
      budgetActuals: budgetVsActual.lines.map((l) => ({
        period: l.period,
        category: l.category,
        budgetAmount: l.budgetAmount,
        actualAmount: l.actualAmount,
      })),
      actualCashForForecastVariance: currentCash,
    });

    const raw: TreasuryRawSnapshot = {
      companyId,
      companyName: company.name,
      currency: company.currency,
      asOfDate,
      reportingPeriod: company.reportingPeriod,
      periodGranularity: company.periodGranularity,
      bankAccountIds: bankAccounts.map((b) => b.id),
      movements: movementInputs,
      receivables: receivableInputs,
      payables: payableInputs,
      budgetVsActual,
      alerts: engineResult.alerts,
      scenarioCount,
      kpis,
      engineForecastLines: engineResult.forecastLines,
      weeklyActuals:
        weeklyActuals.length > 0
          ? weeklyActuals.map((a) => ({
              period: a.period,
              category: a.category,
              amount: Number(a.actualAmount),
              accountCode: a.accountCode ?? undefined,
            }))
          : undefined,
      forecastLookbackWeeks: company.forecastLookbackWeeks,
      forecastHorizonWeeks: horizonWeeks,
    };

    return buildTreasurySummary(raw);
  }
}
