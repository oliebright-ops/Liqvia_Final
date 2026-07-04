import { Injectable, NotFoundException } from '@nestjs/common';
import { Company, ForecastType, LiquidityStatus } from '@prisma/client';
import {
  ApPaymentPriority,
  computeAccountLedger,
  DEFAULT_DEMO_COMPANY_ID,
  deriveWeeklyActualsFromBankMovements,
  KPI_DEFAULTS,
  RollingBudgetCategory,
  TreasuryAlert,
  WeeklyForecastLine,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringObligationsService } from '../recurring-obligations/recurring-obligations.service';
import { AlertRulesService } from './alert-rules.service';
import { ForecastCalculationService } from './forecast-calculation.service';
import { LiquidityRiskService } from './liquidity-risk.service';
import { TreasuryKpiService } from './treasury-kpi.service';

function addWeeksIso(dateStr: string, weeks: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export interface TreasuryEngineResult {
  companyId: string;
  asOfDate: string;
  openingCash: number;
  forecastLines: WeeklyForecastLine[];
  runwayWeeks: number | null;
  liquidityStatus: LiquidityStatus;
  week13ClosingCash: number | null;
  alerts: TreasuryAlert[];
  /**
   * Raw entities fetched to build this result. Callers that need to build additional
   * derived views (e.g. the dashboard SummaryReport) MUST reuse this data instead of
   * re-querying — two independent reads of the same tables within one logical request
   * can observe different snapshots under concurrent writes, which previously caused
   * the dashboard/AI-CFO forecast figures to silently disagree with this engine result.
   */
  rawData: LoadedFinancialData;
}

export interface LoadedFinancialData {
  company: Company;
  bankAccountIds: string[];
  movements: Array<{
    id: string;
    bankAccountId: string;
    movementDate: string;
    amount: number;
    isInflow: boolean;
    description: string | null;
  }>;
  receivables: Array<{
    id: string;
    counterparty: string;
    outstandingAmount: number;
    invoiceDate: string;
    dueDate: string;
  }>;
  payables: Array<{
    id: string;
    counterparty: string;
    outstandingAmount: number;
    billDate: string;
    dueDate: string;
    supplierPriority: ApPaymentPriority;
  }>;
  weeklyActuals?: Array<{
    period: string;
    category: RollingBudgetCategory;
    amount: number;
    accountCode?: string;
  }>;
  openingCash: number;
}

@Injectable()
export class TreasuryEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastCalculationService,
    private readonly liquidity: LiquidityRiskService,
    private readonly kpis: TreasuryKpiService,
    private readonly alerts: AlertRulesService,
    private readonly recurringObligations: RecurringObligationsService,
  ) {}

  async generateForCompany(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    persist = false,
    horizonWeeksOverride?: number,
  ): Promise<TreasuryEngineResult> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const rawData = await this.loadFinancialData(companyId, asOfDate);
    const company = rawData.company;

    const input = this.toForecastInput(rawData, asOfDate);
    const horizonWeeks = horizonWeeksOverride ?? company.forecastHorizonWeeks;
    const forecastLines = this.forecast.calculateBaselineForecast({
      ...input,
      horizonWeeks,
    });
    const week13 = forecastLines.find((l) => l.weekIndex === horizonWeeks);
    const weeklyNetBurn = this.kpis.calculateWeeklyNetBurn(
      forecastLines.map((l) => ({
        weekStart: l.weekStart,
        inflows: l.forecastInflows,
        outflows: l.forecastOutflows,
      })),
    );
    const runwayWeeks = this.liquidity.calculateRunwayWeeks(input.openingCash, weeklyNetBurn);
    const liquidityStatus = this.liquidity.resolveLiquidityStatus({
      currentCash: input.openingCash,
      runwayWeeks,
      forecastLines,
    });

    // Reuse the SAME receivables/payables snapshot used to build forecastLines above —
    // a separate re-query here previously let alerts describe a different moment in
    // time than the forecast they're supposed to explain (see rawData doc comment).
    const alertList = this.alerts.evaluate({
      forecastLines,
      overdueReceivables: this.kpis.calculateOverdueReceivables(
        rawData.receivables.map((r) => ({
          outstandingAmount: r.outstandingAmount,
          invoiceDate: r.invoiceDate,
          dueDate: r.dueDate,
        })),
        asOfDate,
      ),
      upcomingPayables: this.kpis.calculateUpcomingPayables(
        rawData.payables.map((p) => ({
          outstandingAmount: p.outstandingAmount,
          billDate: p.billDate,
          dueDate: p.dueDate,
        })),
        asOfDate,
        KPI_DEFAULTS.upcomingPayablesDays,
      ),
      runwayWeeks,
      liquidityStatus,
      currency: company.currency,
    });

    if (persist) {
      await this.persistForecast(companyId, forecastLines);
      await this.persistAlerts(companyId, alertList);
    }

    return {
      companyId,
      asOfDate,
      openingCash: input.openingCash,
      forecastLines,
      runwayWeeks,
      liquidityStatus,
      week13ClosingCash: week13?.closingCash ?? null,
      alerts: alertList,
      rawData,
    };
  }

  /** Public accessor for scenario modelling: baseline forecast inputs from DB. */
  async getForecastInput(companyId: string) {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const rawData = await this.loadFinancialData(companyId, asOfDate);
    return this.toForecastInput(rawData, asOfDate);
  }

  /**
   * Single fetch for every entity needed to compute a company's forecast, alerts, and
   * dashboard summary. Callers MUST reuse the returned object rather than re-querying
   * Prisma for the same tables — see the doc comment on `TreasuryEngineResult.rawData`.
   */
  async loadFinancialData(companyId: string, asOfDate: string): Promise<LoadedFinancialData> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const [bankAccounts, allMovements, receivablesRaw, payablesRaw, weeklyActuals] =
      await Promise.all([
        this.prisma.bankAccount.findMany({ where: { companyId, deletedAt: null } }),
        this.prisma.cashMovement.findMany({
          where: { companyId },
          orderBy: { movementDate: 'desc' },
        }),
        this.prisma.receivable.findMany({ where: { companyId, deletedAt: null } }),
        this.prisma.payable.findMany({ where: { companyId, deletedAt: null } }),
        this.prisma.weeklyActual.findMany({
          where: {
            companyId,
            NOT: { uploadBatch: { templateType: 'expense_report' } },
          },
        }),
      ]);

    const bankAccountIds = bankAccounts.map((b) => b.id);
    const movements = allMovements.map((m) => ({
      id: m.id,
      bankAccountId: m.bankAccountId,
      movementDate: m.movementDate.toISOString(),
      amount: Number(m.amount),
      isInflow: m.isInflow,
      description: m.description,
    }));

    const openingCash = bankAccountIds.reduce((sum, id) => {
      const accountMovements = movements.filter((m) => m.bankAccountId === id);
      return sum + computeAccountLedger(accountMovements, asOfDate).closingBalance;
    }, 0);

    const receivables = receivablesRaw.map((r) => ({
      id: r.id,
      counterparty: r.customerName,
      outstandingAmount: Number(r.outstandingAmount),
      invoiceDate: r.invoiceDate.toISOString().slice(0, 10),
      dueDate: r.dueDate.toISOString().slice(0, 10),
    }));
    const payables = payablesRaw.map((p) => ({
      id: p.id,
      counterparty: p.supplierName,
      outstandingAmount: Number(p.outstandingAmount),
      billDate: p.billDate.toISOString().slice(0, 10),
      dueDate: p.dueDate.toISOString().slice(0, 10),
      supplierPriority: p.supplierPriority,
    }));

    // Recurring obligations (payroll, rent, GST/BAS, loan repayments, etc.) are projected
    // fresh per request and merged in as synthetic payable-like rows — never persisted as
    // real Payable records, so AP ageing screens only ever show actual uploaded bills.
    const horizonEndDate = addWeeksIso(asOfDate, company.forecastHorizonWeeks ?? 13);
    const syntheticPayables = await this.recurringObligations.asSyntheticPayables(
      companyId,
      asOfDate,
      horizonEndDate,
    );
    payables.push(...syntheticPayables);

    let weeklyActualsRows =
      weeklyActuals.length > 0
        ? weeklyActuals.map((a) => ({
            period: a.period,
            category: a.category,
            amount: Number(a.actualAmount),
            accountCode: a.accountCode ?? undefined,
          }))
        : undefined;

    if (!weeklyActualsRows?.length && movements.length > 0) {
      weeklyActualsRows = deriveWeeklyActualsFromBankMovements(
        movements.map((m) => ({
          movementDate: m.movementDate,
          amount: m.amount,
          isInflow: m.isInflow,
          description: m.description,
        })),
        asOfDate,
      ).map((row) => ({
        period: row.period,
        category: row.category,
        amount: row.amount,
        accountCode: row.accountCode ?? undefined,
      }));
    }

    return {
      company,
      bankAccountIds,
      movements,
      receivables,
      payables,
      weeklyActuals: weeklyActualsRows,
      openingCash,
    };
  }

  private toForecastInput(rawData: LoadedFinancialData, asOfDate: string) {
    return {
      asOfDate,
      openingCash: rawData.openingCash,
      forecastLookbackWeeks: rawData.company.forecastLookbackWeeks ?? 4,
      weeklyActuals: rawData.weeklyActuals,
      receivables: rawData.receivables.map((r) => ({
        outstandingAmount: r.outstandingAmount,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
      })),
      payables: rawData.payables.map((p) => ({
        outstandingAmount: p.outstandingAmount,
        dueDate: p.dueDate,
        supplierPriority: p.supplierPriority,
      })),
    };
  }

  private async persistForecast(companyId: string, lines: WeeklyForecastLine[]) {
    await this.prisma.cashForecast.deleteMany({
      where: { companyId, forecastType: ForecastType.baseline, scenarioId: null },
    });

    const record = await this.prisma.cashForecast.create({
      data: {
        companyId,
        forecastType: ForecastType.baseline,
        weekCount: lines.length,
      },
    });

    await this.prisma.forecastLine.createMany({
      data: lines.map((l) => ({
        cashForecastId: record.id,
        weekIndex: l.weekIndex,
        weekStart: new Date(l.weekStart),
        openingCash: l.openingCash,
        forecastInflows: l.forecastInflows,
        forecastOutflows: l.forecastOutflows,
        closingCash: l.closingCash,
        liquidityStatus: l.liquidityStatus,
      })),
    });
  }

  private async persistAlerts(companyId: string, alertList: TreasuryAlert[]) {
    await this.prisma.alert.updateMany({
      where: { companyId, resolved: false },
      data: { resolved: true, resolvedAt: new Date() },
    });

    for (const a of alertList) {
      // free_cash_risk is computed at dashboard read time — not stored in DB
      if (a.alertType === 'free_cash_risk') continue;

      await this.prisma.alert.create({
        data: {
          companyId,
          alertType: a.alertType,
          severity: a.severity,
          message: a.message,
          metadata: (a.params ?? (a.weekIndex ? { weekIndex: a.weekIndex } : undefined)) as
            | object
            | undefined,
        },
      });
    }
  }

  /** Read the latest persisted baseline forecast for a company. */
  async getStoredForecast(companyId: string): Promise<WeeklyForecastLine[]> {
    const record = await this.prisma.cashForecast.findFirst({
      where: { companyId, forecastType: ForecastType.baseline, scenarioId: null },
      orderBy: { generatedAt: 'desc' },
      include: { lines: { orderBy: { weekIndex: 'asc' } } },
    });
    if (!record) return [];
    return record.lines.map((l) => ({
      weekIndex: l.weekIndex,
      weekStart: l.weekStart.toISOString().slice(0, 10),
      openingCash: Number(l.openingCash),
      forecastInflows: Number(l.forecastInflows),
      forecastOutflows: Number(l.forecastOutflows),
      closingCash: Number(l.closingCash),
      liquidityStatus: l.liquidityStatus,
    }));
  }

  /** Read active (unresolved) alerts for a company. */
  async getStoredAlerts(companyId: string) {
    return this.prisma.alert.findMany({
      where: { companyId, resolved: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Recalculate and persist after an upload changes the data. */
  async recalculateAfterUpload(companyId: string): Promise<void> {
    try {
      await this.generateForCompany(companyId, true);
    } catch {
      // Forecast recalculation is best-effort; uploads must not fail because of it.
    }
  }
}
