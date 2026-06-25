import type { BudgetVarianceResult } from './kpi';
import {
  aggregateWeeklyRows,
  cashFlowMagnitude,
  computeRollingVariance,
  getPastWeekPeriods,
  isInflowCategory,
  type RollingBudgetCategory,
  type WeeklyAmountRow,
} from './rolling-budget';

export type ForecastBacktestQuality = 'insufficient' | 'partial' | 'good';

export interface ForecastBacktestNetWeek {
  period: string;
  predictedNet: number;
  actualNet: number;
  error: number;
  errorPercent: number | null;
}

export interface ForecastBacktestResult {
  quality: ForecastBacktestQuality;
  lookbackWeeks: number;
  /** Completed rolling-average backtest weeks in the 14-week window. */
  netCashWeeks: number;
  meanAbsoluteNetError: number | null;
  meanAbsoluteNetErrorPercent: number | null;
  budgetVarianceLineCount: number;
  meanAbsoluteBudgetErrorPercent: number | null;
  sampleNetWeeks: ForecastBacktestNetWeek[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function netCashForPeriod(
  byPeriod: Map<string, Map<RollingBudgetCategory, number>>,
  period: string,
): number | null {
  const cats = byPeriod.get(period);
  if (!cats) return null;
  let inflows = 0;
  let outflows = 0;
  for (const [cat, amount] of cats) {
    const magnitude = cashFlowMagnitude(cat, amount);
    if (isInflowCategory(cat)) inflows += magnitude;
    else outflows += magnitude;
  }
  return round2(inflows - outflows);
}

function rollingNetFromPriorPeriods(
  byPeriod: Map<string, Map<RollingBudgetCategory, number>>,
  sourcePeriods: string[],
): number {
  if (sourcePeriods.length === 0) return 0;
  let inflows = 0;
  let outflows = 0;
  for (const period of sourcePeriods) {
    const cats = byPeriod.get(period);
    if (!cats) continue;
    for (const [cat, amount] of cats) {
      const magnitude = cashFlowMagnitude(cat, amount);
      if (isInflowCategory(cat)) inflows += magnitude;
      else outflows += magnitude;
    }
  }
  const divisor = sourcePeriods.length;
  return round2(inflows / divisor - outflows / divisor);
}

function meanAbsolutePercent(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((s, v) => s + Math.abs(v), 0) / values.length);
}

function resolveQuality(
  netWeeks: number,
  budgetLines: number,
  actualPeriods: number,
): ForecastBacktestQuality {
  if (actualPeriods < 2) return 'insufficient';
  if (netWeeks >= 3 && (budgetLines >= 4 || netWeeks >= 4)) return 'good';
  if (netWeeks >= 1 || budgetLines >= 1) return 'partial';
  return 'insufficient';
}

/**
 * Historical backtest: rolling-average net cash vs weekly actuals, plus budget variance MAPE
 * over the past 14-week window (same window as computeRollingVariance).
 */
export function computeForecastBacktest(input: {
  asOfDate: string;
  lookbackWeeks: number;
  weeklyActuals?: WeeklyAmountRow[];
  budgetRows?: WeeklyAmountRow[];
  budgetVarianceLines?: BudgetVarianceResult[];
}): ForecastBacktestResult {
  const clampedLookback = Math.min(4, Math.max(1, input.lookbackWeeks));
  const actualRows = input.weeklyActuals ?? [];
  const pastPeriods = getPastWeekPeriods(input.asOfDate);
  const byPeriod = aggregateWeeklyRows(actualRows);
  const periodsWithData = pastPeriods.filter((p) => byPeriod.has(p));

  const sampleNetWeeks: ForecastBacktestNetWeek[] = [];

  for (let i = clampedLookback; i < pastPeriods.length; i++) {
    const targetPeriod = pastPeriods[i];
    const actualNet = netCashForPeriod(byPeriod, targetPeriod);
    if (actualNet === null) continue;

    const priorPeriods = pastPeriods.slice(0, i).filter((p) => byPeriod.has(p));
    const sourcePeriods = priorPeriods.slice(-clampedLookback);
    if (sourcePeriods.length < clampedLookback) continue;

    const predictedNet = rollingNetFromPriorPeriods(byPeriod, sourcePeriods);
    const error = round2(predictedNet - actualNet);
    const errorPercent =
      actualNet !== 0 ? round1((Math.abs(error) / Math.abs(actualNet)) * 100) : null;

    sampleNetWeeks.push({
      period: targetPeriod,
      predictedNet,
      actualNet,
      error,
      errorPercent,
    });
  }

  const netErrors = sampleNetWeeks.map((w) => Math.abs(w.error));
  const netErrorPercents = sampleNetWeeks
    .map((w) => w.errorPercent)
    .filter((v): v is number => v !== null);

  let budgetVarianceLineCount = 0;
  let meanAbsoluteBudgetErrorPercent: number | null = null;

  if (input.budgetRows && input.budgetRows.length > 0 && actualRows.length > 0) {
    const varianceLines = computeRollingVariance(
      input.budgetRows,
      actualRows,
      input.asOfDate,
    ).filter((l) => l.budgetAmount > 0 && l.actualAmount !== 0);
    budgetVarianceLineCount = varianceLines.length;
    const percents = varianceLines
      .map((l) => l.variancePercent)
      .filter((v): v is number => v !== null)
      .map(Math.abs);
    meanAbsoluteBudgetErrorPercent = meanAbsolutePercent(percents);
  } else if (input.budgetVarianceLines) {
    const window = new Set(pastPeriods);
    const lines = input.budgetVarianceLines.filter(
      (l) =>
        window.has(l.period) && l.budgetAmount > 0 && l.actualAmount !== 0,
    );
    budgetVarianceLineCount = lines.length;
    const percents = lines
      .map((l) => l.variancePercent)
      .filter((v): v is number => v !== null)
      .map(Math.abs);
    meanAbsoluteBudgetErrorPercent = meanAbsolutePercent(percents);
  }

  return {
    quality: resolveQuality(
      sampleNetWeeks.length,
      budgetVarianceLineCount,
      periodsWithData.length,
    ),
    lookbackWeeks: clampedLookback,
    netCashWeeks: sampleNetWeeks.length,
    meanAbsoluteNetError:
      netErrors.length > 0
        ? round2(netErrors.reduce((s, v) => s + v, 0) / netErrors.length)
        : null,
    meanAbsoluteNetErrorPercent: meanAbsolutePercent(netErrorPercents),
    budgetVarianceLineCount,
    meanAbsoluteBudgetErrorPercent,
    sampleNetWeeks: sampleNetWeeks.slice(-4),
  };
}
