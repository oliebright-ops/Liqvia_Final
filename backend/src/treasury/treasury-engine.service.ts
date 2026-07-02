import { Injectable, NotFoundException } from '@nestjs/common';
import { ForecastType, LiquidityStatus } from '@prisma/client';
import {
  computeAccountLedger,
  DEFAULT_DEMO_COMPANY_ID,
  deriveWeeklyActualsFromBankMovements,
  KPI_DEFAULTS,
  TreasuryAlert,
  WeeklyForecastLine,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AlertRulesService } from './alert-rules.service';
import { ForecastCalculationService } from './forecast-calculation.service';
import { LiquidityRiskService } from './liquidity-risk.service';
import { TreasuryKpiService } from './treasury-kpi.service';

export interface TreasuryEngineResult {
  companyId: string;
  asOfDate: string;
  openingCash: number;
  forecastLines: WeeklyForecastLine[];
  runwayWeeks: number | null;
  liquidityStatus: LiquidityStatus;
  week13ClosingCash: number | null;
  alerts: TreasuryAlert[];
}

@Injectable()
export class TreasuryEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastCalculationService,
    private readonly liquidity: LiquidityRiskService,
    private readonly kpis: TreasuryKpiService,
    private readonly alerts: AlertRulesService,
  ) {}

  async generateForCompany(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    persist = false,
    horizonWeeksOverride?: number,
  ): Promise<TreasuryEngineResult> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const asOfDate = new Date().toISOString().slice(0, 10);
    const input = await this.loadForecastInput(companyId, asOfDate);
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

    const receivables = await this.prisma.receivable.findMany({
      where: { companyId, deletedAt: null },
    });
    const payables = await this.prisma.payable.findMany({
      where: { companyId, deletedAt: null },
    });

    const alertList = this.alerts.evaluate({
      forecastLines,
      overdueReceivables: this.kpis.calculateOverdueReceivables(
        receivables.map((r) => ({
          outstandingAmount: Number(r.outstandingAmount),
          invoiceDate: r.invoiceDate.toISOString().slice(0, 10),
          dueDate: r.dueDate.toISOString().slice(0, 10),
        })),
        asOfDate,
      ),
      upcomingPayables: this.kpis.calculateUpcomingPayables(
        payables.map((p) => ({
          outstandingAmount: Number(p.outstandingAmount),
          billDate: p.billDate.toISOString().slice(0, 10),
          dueDate: p.dueDate.toISOString().slice(0, 10),
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
    };
  }

  /** Public accessor for scenario modelling: baseline forecast inputs from DB. */
  async getForecastInput(companyId: string) {
    const asOfDate = new Date().toISOString().slice(0, 10);
    return this.loadForecastInput(companyId, asOfDate);
  }

  private async loadForecastInput(companyId: string, asOfDate: string) {
    const allMovements = await this.prisma.cashMovement.findMany({
      where: { companyId },
      orderBy: { movementDate: 'desc' },
    });

    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { companyId, deletedAt: null },
    });

    const openingCash = bankAccounts.reduce((sum, b) => {
      const accountMovements = allMovements
        .filter((m) => m.bankAccountId === b.id)
        .map((m) => ({
          id: m.id,
          bankAccountId: m.bankAccountId,
          movementDate: m.movementDate.toISOString(),
          amount: Number(m.amount),
          isInflow: m.isInflow,
          description: m.description,
        }));
      return sum + computeAccountLedger(accountMovements, asOfDate).closingBalance;
    }, 0);

    const receivables = await this.prisma.receivable.findMany({
      where: { companyId, deletedAt: null },
    });
    const payables = await this.prisma.payable.findMany({
      where: { companyId, deletedAt: null },
    });

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const weeklyActuals = await this.prisma.weeklyActual.findMany({
      where: {
        companyId,
        NOT: {
          uploadBatch: {
            templateType: 'expense_report',
          },
        },
      },
    });

    let weeklyActualsRows =
      weeklyActuals.length > 0
        ? weeklyActuals.map((a) => ({
            period: a.period,
            category: a.category,
            amount: Number(a.actualAmount),
            accountCode: a.accountCode ?? undefined,
          }))
        : undefined;

    if (!weeklyActualsRows?.length && allMovements.length > 0) {
      weeklyActualsRows = deriveWeeklyActualsFromBankMovements(
        allMovements.map((m) => ({
          movementDate: m.movementDate.toISOString(),
          amount: Number(m.amount),
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
      asOfDate,
      openingCash,
      forecastLookbackWeeks: company?.forecastLookbackWeeks ?? 4,
      weeklyActuals: weeklyActualsRows,
      receivables: receivables.map((r) => ({
        outstandingAmount: Number(r.outstandingAmount),
        invoiceDate: r.invoiceDate.toISOString().slice(0, 10),
        dueDate: r.dueDate.toISOString().slice(0, 10),
      })),
      payables: payables.map((p) => ({
        outstandingAmount: Number(p.outstandingAmount),
        dueDate: p.dueDate.toISOString().slice(0, 10),
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
