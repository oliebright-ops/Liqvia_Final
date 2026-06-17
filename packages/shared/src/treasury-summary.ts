import type { BudgetVarianceResult, TreasuryKpiDashboard } from './kpi';
import {
  computeArDue30Days,
  computeCashPosition,
  countStaleUnreconciledTransactions,
  DashboardKpiCards,
  DashboardTransactionRow,
  hasStaleUnreconciledTransactions,
  mapRecentTransactions,
  type CashMovementInput,
  type ReceivableMetricInput,
} from './dashboard-metrics';
import { buildForecastModel, ForecastModelResult } from './forecast-model';
import { buildFreeCashReport, mergeFreeCashAlerts } from './free-cash';
import { clampForecastHorizon, DEFAULT_FORECAST_HORIZON } from './treasury';
import type { LiquidityStatus, TreasuryAlert, WeeklyForecastLine } from './treasury';
import { resolveReportingPeriod, type PeriodGranularity } from './reporting-period';
import type { WeeklyAmountRow } from './rolling-budget';

/** Gold-standard executive metrics — every dashboard KPI binds to this object. */
export interface SummaryReport {
  companyId: string;
  companyName: string;
  currency: string;
  asOfDate: string;
  cash: {
    total: number;
    accountCount: number;
    trend: number | null;
  };
  budget: {
    mtdVariance: number | null;
    variancePct: number | null;
    period: string;
    hasData: boolean;
  };
  liquidity: {
    runwayWeeks: number | null;
    forecastClosing: number | null;
    weeklyBurn: number;
    liquidityStatus: LiquidityStatus;
    horizonWeeks: number;
    freeAvailableCash: number;
    fixedOutflowsHorizon: number;
  };
  risk: {
    arDelayed90: number | null;
    arDue30: number | null;
    apOverdue: number;
  };
  forecast: WeeklyForecastLine[];
  forecastModel: ForecastModelResult;
  budgetVsActual: {
    totalBudget: number;
    totalActual: number;
    totalVariance: number;
    lines: BudgetVarianceResult[];
  };
  kpis: TreasuryKpiDashboard;
  kpiCards: DashboardKpiCards;
  recentTransactions: DashboardTransactionRow[];
  alerts: TreasuryAlert[];
  reconciliation: TreasuryReconciliation;
  scenarioCount: number;
}

export interface TreasuryReconciliation {
  isConsistent: boolean;
  transactionActualsTotal: number;
  budgetActualsTotal: number;
  hasBankAccounts: boolean;
  hasStaleUnreconciledTransactions: boolean;
  staleUnreconciledCount: number;
}

export interface TreasuryRawSnapshot {
  companyId: string;
  companyName: string;
  currency: string;
  asOfDate: string;
  bankAccountIds: string[];
  reportingPeriod: string | null;
  periodGranularity: PeriodGranularity;
  movements: CashMovementInput[];
  receivables: Array<ReceivableMetricInput & { id: string; counterparty: string }>;
  payables: Array<{
    id: string;
    counterparty: string;
    dueDate: string;
    outstandingAmount: number;
    billDate: string;
  }>;
  budgetVsActual: {
    totalBudget: number;
    totalActual: number;
    totalVariance: number;
    lines: BudgetVarianceResult[];
  };
  alerts: TreasuryAlert[];
  scenarioCount: number;
  /** Pre-built KPI dashboard block from treasury-kpi.service */
  kpis: TreasuryKpiDashboard;
  /** Slim forecast lines from engine (used for KPI buildDashboard input) */
  engineForecastLines: WeeklyForecastLine[];
  weeklyActuals?: WeeklyAmountRow[];
  forecastLookbackWeeks?: number;
  forecastHorizonWeeks?: number;
}

/**
 * Unified Treasury Data Controller — computes all executive metrics once.
 * Budget variance uses budget − actual (same convention as BudgetVsActual page).
 * Liquidity/runway sourced directly from buildForecastModel (same as Cash Forecast page).
 */
export function buildTreasurySummary(raw: TreasuryRawSnapshot): SummaryReport {
  const cashPosition = computeCashPosition(raw.bankAccountIds, raw.movements, raw.asOfDate);

  const horizonWeeks = clampForecastHorizon(raw.forecastHorizonWeeks ?? DEFAULT_FORECAST_HORIZON);

  const forecastModel = buildForecastModel({
    asOfDate: raw.asOfDate,
    openingCash: cashPosition.totalBalance,
    horizonWeeks,
    weeklyActuals: raw.weeklyActuals,
    forecastLookbackWeeks: raw.forecastLookbackWeeks,
    receivables: raw.receivables.map((r) => ({
      id: r.id,
      counterparty: r.counterparty,
      dueDate: r.dueDate,
      outstandingAmount: r.outstandingAmount,
    })),
    payables: raw.payables.map((p) => ({
      id: p.id,
      counterparty: p.counterparty,
      dueDate: p.dueDate,
      outstandingAmount: p.outstandingAmount,
    })),
  });

  const forecast: WeeklyForecastLine[] = forecastModel.weeks.map((w) => ({
    weekIndex: w.weekIndex,
    weekStart: w.weekStart,
    openingCash: w.openingCash,
    forecastInflows: w.forecastInflows,
    forecastOutflows: w.forecastOutflows,
    closingCash: w.closingCash,
    liquidityStatus: w.liquidityStatus,
  }));

  const budget = computeBudgetExecutiveVariance(
    raw.budgetVsActual,
    raw.asOfDate,
    raw.reportingPeriod,
    raw.periodGranularity,
  );

  const arMetrics = computeArDue30Days(raw.receivables, raw.asOfDate);
  const apOverdue = raw.payables
    .filter((p) => p.dueDate < raw.asOfDate && p.outstandingAmount > 0)
    .reduce((s, p) => s + p.outstandingAmount, 0);

  const reconciliation = {
    ...validateTreasuryConsistency({
      movements: raw.movements,
      asOfDate: raw.asOfDate,
      budgetActualsTotal: raw.budgetVsActual.totalActual,
    }),
    hasBankAccounts: cashPosition.bankAccountCount > 0,
    hasStaleUnreconciledTransactions: hasStaleUnreconciledTransactions(
      raw.movements,
      raw.asOfDate,
    ),
    staleUnreconciledCount: countStaleUnreconciledTransactions(raw.movements, raw.asOfDate),
  };

  const freeCash = buildFreeCashReport(
    cashPosition.totalBalance,
    {
      asOfDate: raw.asOfDate,
      openingCash: cashPosition.totalBalance,
      horizonWeeks,
      weeklyActuals: raw.weeklyActuals,
      forecastLookbackWeeks: raw.forecastLookbackWeeks,
      receivables: raw.receivables.map((r) => ({
        id: r.id,
        counterparty: r.counterparty,
        dueDate: r.dueDate,
        outstandingAmount: r.outstandingAmount,
      })),
      payables: raw.payables.map((p) => ({
        id: p.id,
        counterparty: p.counterparty,
        dueDate: p.dueDate,
        outstandingAmount: p.outstandingAmount,
      })),
    },
    apOverdue,
    raw.currency,
  );

  const summary: SummaryReport = {
    companyId: raw.companyId,
    companyName: raw.companyName,
    currency: raw.currency,
    asOfDate: raw.asOfDate,
    cash: {
      total: cashPosition.totalBalance,
      accountCount: cashPosition.bankAccountCount,
      trend: cashPosition.weekOverWeekChangePct,
    },
    budget,
    liquidity: {
      runwayWeeks: forecastModel.runwayWeeks,
      forecastClosing: forecastModel.projectedClosing,
      weeklyBurn: forecastModel.weeklyNetBurn,
      liquidityStatus: forecastModel.executiveLiquidity,
      horizonWeeks: freeCash.horizonWeeks,
      freeAvailableCash: freeCash.freeAvailableCash,
      fixedOutflowsHorizon: freeCash.fixedOutflowsHorizon,
    },
    risk: {
      arDelayed90: arMetrics.delayed90PlusDays,
      arDue30: arMetrics.amountDue30Days,
      apOverdue: round2(apOverdue),
    },
    forecast,
    forecastModel,
    budgetVsActual: raw.budgetVsActual,
    kpis: {
      ...raw.kpis,
      currentCash: cashPosition.totalBalance,
      week13ClosingCash: forecastModel.projectedClosing,
      weeklyNetBurn: forecastModel.weeklyNetBurn,
      runwayWeeks: forecastModel.runwayWeeks,
      liquidityStatus: forecastModel.executiveLiquidity,
    },
    kpiCards: buildKpiCardsFromSummary({
      cash: cashPosition,
      budget,
      liquidity: {
        runwayWeeks: forecastModel.runwayWeeks,
        weeklyBurn: forecastModel.weeklyNetBurn,
        liquidityStatus: forecastModel.executiveLiquidity,
      },
      arMetrics,
    }),
    recentTransactions: mapRecentTransactions(raw.movements, raw.asOfDate, 10),
    alerts: mergeFreeCashAlerts(
      raw.alerts,
      freeCash.freeAvailableCash,
      cashPosition.totalBalance,
      freeCash.horizonWeeks,
    ),
    reconciliation,
    scenarioCount: raw.scenarioCount,
  };

  return summary;
}

/**
 * Budget variance for the executive dashboard.
 * Uses current-month lines when available; otherwise falls back to budgetVsActual.totalVariance
 * so the dashboard KPI always matches the Budget vs Actual page summary cards.
 */
export function computeBudgetExecutiveVariance(
  budgetVsActual: TreasuryRawSnapshot['budgetVsActual'],
  asOfDate: string,
  reportingPeriod?: string | null,
  periodGranularity: PeriodGranularity = 'monthly',
): SummaryReport['budget'] {
  const period = resolveReportingPeriod(asOfDate, reportingPeriod, periodGranularity);
  const mtdLines = budgetVsActual.lines.filter((l) => l.period === period);

  if (mtdLines.length > 0) {
    const mtdBudget = mtdLines.reduce((s, l) => s + l.budgetAmount, 0);
    const mtdActual = mtdLines.reduce((s, l) => s + l.actualAmount, 0);
    const mtdVariance = round2(mtdLines.reduce((s, l) => s + l.varianceAmount, 0));
    const variancePct = mtdBudget !== 0 ? round1((mtdVariance / Math.abs(mtdBudget)) * 100) : null;
    return { mtdVariance, variancePct, period, hasData: true };
  }

  if (budgetVsActual.lines.length === 0) {
    return { mtdVariance: null, variancePct: null, period, hasData: false };
  }

  const latestPeriod = [...new Set(budgetVsActual.lines.map((l) => l.period))].sort().at(-1)!;
  const variance = round2(budgetVsActual.totalVariance);
  const variancePct =
    budgetVsActual.totalBudget !== 0 ? round1((variance / budgetVsActual.totalBudget) * 100) : null;

  return {
    mtdVariance: variance,
    variancePct,
    period: latestPeriod,
    hasData: true,
  };
}

/** Bind KPI card props directly to SummaryReport slices — no duplicate formulas. */
export function buildKpiCardsFromSummary(slices: {
  cash: ReturnType<typeof computeCashPosition>;
  budget: SummaryReport['budget'];
  liquidity: Pick<SummaryReport['liquidity'], 'runwayWeeks' | 'weeklyBurn' | 'liquidityStatus'>;
  arMetrics: ReturnType<typeof computeArDue30Days>;
}): DashboardKpiCards {
  return {
    cashPosition: {
      totalBalance: slices.cash.totalBalance,
      bankAccountCount: slices.cash.bankAccountCount,
      weekOverWeekChangePct: slices.cash.weekOverWeekChangePct,
      hasData: slices.cash.hasData,
    },
    cashRunway: {
      runwayWeeks: slices.liquidity.runwayWeeks,
      weeklyBurn: slices.liquidity.weeklyBurn,
      liquidityStatus: slices.liquidity.liquidityStatus,
      hasData: slices.cash.hasData,
    },
    budgetVarianceMtd: {
      varianceAmount: slices.budget.mtdVariance,
      variancePct: slices.budget.variancePct,
      period: slices.budget.period,
      hasData: slices.budget.hasData,
    },
    arDue30Days: {
      amountDue30Days: slices.arMetrics.amountDue30Days,
      delayed90PlusDays: slices.arMetrics.delayed90PlusDays,
      hasData: slices.arMetrics.hasData,
    },
  };
}

/** Data integrity check — transaction actuals vs budget-table actuals for current month. */
export function validateTreasuryConsistency(input: {
  movements: CashMovementInput[];
  asOfDate: string;
  budgetActualsTotal: number;
  tolerance?: number;
}): TreasuryReconciliation {
  const period = input.asOfDate.slice(0, 7);
  const transactionActualsTotal = round2(
    input.movements
      .filter(
        (m) =>
          !m.isInflow &&
          m.description !== 'Balance upload' &&
          m.movementDate.slice(0, 7) === period,
      )
      .reduce((s, m) => s + m.amount, 0),
  );

  const budgetActualsTotal = round2(input.budgetActualsTotal);
  const tolerance = input.tolerance ?? 1;
  const isConsistent = Math.abs(transactionActualsTotal - budgetActualsTotal) <= tolerance;

  return {
    isConsistent,
    transactionActualsTotal,
    budgetActualsTotal,
    hasBankAccounts: false,
    hasStaleUnreconciledTransactions: false,
    staleUnreconciledCount: 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
