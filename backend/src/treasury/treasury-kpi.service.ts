import { Injectable } from '@nestjs/common';
import { computeBudgetVarianceAmount, computeBudgetVariancePercent } from '@liqvia2/shared';
import {
  BankBalanceInput,
  BudgetActualInput,
  BudgetVarianceResult,
  ForecastLineInput,
  KPI_DEFAULTS,
  PayableInput,
  ReceivableInput,
  TreasuryKpiDashboard,
  WeeklyCashFlowInput,
} from '@liqvia2/shared';
import { LiquidityRiskService } from './liquidity-risk.service';

@Injectable()
export class TreasuryKpiService {
  constructor(private readonly liquidity: LiquidityRiskService) {}

  /** Sum of the latest balance per bank account (each input row is already account-scoped). */
  calculateCurrentCash(balances: BankBalanceInput[]): number {
    if (balances.length === 0) return 0;
    return balances.reduce((sum, b) => sum + b.balance, 0);
  }

  /** Closing cash at the final week of the active forecast horizon. */
  calculateWeek13ClosingCash(lines: ForecastLineInput[]): number | null {
    if (lines.length === 0) return null;
    const horizonWeek = Math.max(...lines.map((l) => l.weekIndex));
    return lines.find((l) => l.weekIndex === horizonWeek)?.closingCash ?? null;
  }

  /**
   * Average weekly net cash outflow over the last N weeks (default 4).
   * Per week: netBurn = outflows - inflows. Only weeks with positive burn count.
   */
  calculateWeeklyNetBurn(
    weeks: WeeklyCashFlowInput[],
    lookbackWeeks: number = KPI_DEFAULTS.burnLookbackWeeks,
  ): number {
    const sorted = [...weeks].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    const recent = sorted.slice(0, lookbackWeeks);
    const burns = recent.map((w) => w.outflows - w.inflows).filter((b) => b > 0);
    if (burns.length === 0) return 0;
    return burns.reduce((s, b) => s + b, 0) / burns.length;
  }

  calculateOverdueReceivables(receivables: ReceivableInput[], asOfDate: string): number {
    return receivables
      .filter((r) => r.dueDate < asOfDate && r.outstandingAmount > 0)
      .reduce((sum, r) => sum + r.outstandingAmount, 0);
  }

  calculateUpcomingPayables(
    payables: PayableInput[],
    asOfDate: string,
    windowDays: number = KPI_DEFAULTS.upcomingPayablesDays,
  ): number {
    const end = addDays(asOfDate, windowDays);
    return payables
      .filter((p) => p.dueDate >= asOfDate && p.dueDate <= end && p.outstandingAmount > 0)
      .reduce((sum, p) => sum + p.outstandingAmount, 0);
  }

  calculateBudgetVariances(rows: BudgetActualInput[]): BudgetVarianceResult[] {
    return rows.map((row) => {
      const varianceAmount = computeBudgetVarianceAmount(
        row.category,
        row.budgetAmount,
        row.actualAmount,
      );
      const variancePercent = computeBudgetVariancePercent(
        row.category,
        row.budgetAmount,
        varianceAmount,
      );
      return {
        period: row.period,
        category: row.category,
        budgetAmount: row.budgetAmount,
        actualAmount: row.actualAmount,
        varianceAmount,
        variancePercent,
      };
    });
  }

  /** Actual minus forecast closing cash for the same period (positive = beat forecast). */
  calculateForecastVariance(actualCash: number, forecastClosingCash: number): number {
    return actualCash - forecastClosingCash;
  }

  /** Weighted average days since invoice date on open AR. */
  calculateCollectionDays(receivables: ReceivableInput[], asOfDate: string): number | null {
    const open = receivables.filter((r) => r.outstandingAmount > 0);
    if (open.length === 0) return null;
    const total = open.reduce((s, r) => s + r.outstandingAmount, 0);
    const weighted = open.reduce(
      (s, r) => s + r.outstandingAmount * daysBetween(r.invoiceDate, asOfDate),
      0,
    );
    return weighted / total;
  }

  /** Weighted average days since bill date on open AP. */
  calculatePayablesDays(payables: PayableInput[], asOfDate: string): number | null {
    const open = payables.filter((p) => p.outstandingAmount > 0);
    if (open.length === 0) return null;
    const total = open.reduce((s, p) => s + p.outstandingAmount, 0);
    const weighted = open.reduce(
      (s, p) => s + p.outstandingAmount * daysBetween(p.billDate, asOfDate),
      0,
    );
    return weighted / total;
  }

  buildDashboard(input: {
    currency: string;
    asOfDate: string;
    bankBalances: BankBalanceInput[];
    forecastLines: ForecastLineInput[];
    weeklyCashFlows: WeeklyCashFlowInput[];
    receivables: ReceivableInput[];
    payables: PayableInput[];
    budgetActuals: BudgetActualInput[];
    actualCashForForecastVariance?: number;
  }): TreasuryKpiDashboard {
    const currentCash = this.calculateCurrentCash(input.bankBalances);
    const week13ClosingCash = this.calculateWeek13ClosingCash(input.forecastLines);
    const weeklyNetBurn = this.calculateWeeklyNetBurn(input.weeklyCashFlows);
    const runwayWeeks = this.liquidity.calculateRunwayWeeks(currentCash, weeklyNetBurn);

    const forecastVarianceAmount =
      input.actualCashForForecastVariance !== undefined && week13ClosingCash !== null
        ? this.calculateForecastVariance(input.actualCashForForecastVariance, week13ClosingCash)
        : null;

    return {
      currency: input.currency,
      asOfDate: input.asOfDate,
      currentCash,
      week13ClosingCash,
      weeklyNetBurn,
      runwayWeeks,
      liquidityStatus: this.liquidity.resolveLiquidityStatus({
        currentCash,
        runwayWeeks,
        forecastLines: input.forecastLines,
      }),
      overdueReceivables: this.calculateOverdueReceivables(input.receivables, input.asOfDate),
      upcomingPayables: this.calculateUpcomingPayables(input.payables, input.asOfDate),
      budgetVariances: this.calculateBudgetVariances(input.budgetActuals),
      forecastVarianceAmount,
      collectionDays: this.calculateCollectionDays(input.receivables, input.asOfDate),
      payablesDays: this.calculatePayablesDays(input.payables, input.asOfDate),
    };
  }
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
