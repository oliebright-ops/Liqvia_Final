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

    // Reuse the SINGLE fetch already performed by the engine (rawData) instead of
    // re-querying bankAccounts/movements/receivables/payables/weeklyActuals here.
    // A second independent read of the same tables could observe a different DB
    // snapshot under concurrent writes, which previously let the dashboard/AI-CFO
    // figures silently disagree with the forecast/alerts computed above.
    const rawData = engineResult.rawData;

    const [budgetVsActual, scenarioCount] = await Promise.all([
      this.budget.getBudgetVsActual(companyId),
      this.prisma.scenario.count({ where: { companyId } }),
    ]);

    const balances = rawData.bankAccountIds.map((id) => {
      const accountMovements = rawData.movements.filter((m) => m.bankAccountId === id);
      const ledger = computeAccountLedger(accountMovements, asOfDate);
      return {
        balance: ledger.closingBalance,
        balanceDate: asOfDate,
      };
    });

    const movementInputs = rawData.movements;
    const receivableInputs = rawData.receivables;
    const payableInputs = rawData.payables;

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
      bankAccountIds: rawData.bankAccountIds,
      movements: movementInputs,
      receivables: receivableInputs,
      payables: payableInputs,
      budgetVsActual,
      alerts: engineResult.alerts,
      scenarioCount,
      kpis,
      engineForecastLines: engineResult.forecastLines,
      weeklyActuals: rawData.weeklyActuals,
      forecastLookbackWeeks: company.forecastLookbackWeeks,
      forecastHorizonWeeks: horizonWeeks,
    };

    return buildTreasurySummary(raw);
  }
}
