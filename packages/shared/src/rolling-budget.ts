import {
  computeBudgetVarianceAmount,
  computeBudgetVariancePercent,
} from './budget-variance';
import { startOfWeekUtc } from './forecast-model';
import { clampForecastHorizon, DEFAULT_FORECAST_HORIZON } from './treasury';
import { toIsoWeek } from './reporting-period';

export const ROLLING_ACTUALS_WEEKS = 14;

export type RollingBudgetCategory =
  | 'revenue'
  | 'payroll'
  | 'expenses'
  | 'capex'
  | 'loan_repayment';

export interface WeeklyAmountRow {
  period: string;
  category: RollingBudgetCategory;
  amount: number;
  accountCode?: string;
}

export interface RollingAverageResult {
  avgInflows: number;
  avgOutflows: number;
  byCategory: Record<RollingBudgetCategory, number>;
  lookbackWeeks: number;
  sourcePeriods: string[];
}

const INFLOW_CATEGORIES: RollingBudgetCategory[] = ['revenue'];
const OUTFLOW_CATEGORIES: RollingBudgetCategory[] = [
  'payroll',
  'expenses',
  'capex',
  'loan_repayment',
];

function parseDateUtc(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function addDaysUtc(iso: string, days: number): string {
  const d = parseDateUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO week periods for the N weeks immediately before the week containing asOfDate. */
export function getPastWeekPeriods(asOfDate: string, weeks = ROLLING_ACTUALS_WEEKS): string[] {
  const currentWeekStart = startOfWeekUtc(asOfDate);
  const periods: string[] = [];
  for (let i = weeks; i >= 1; i--) {
    const weekStart = addDaysUtc(currentWeekStart, -7 * i);
    periods.push(toIsoWeek(weekStart));
  }
  return periods;
}

/** Next N ISO week periods starting the week after asOfDate. */
export function getFutureWeekPeriods(
  asOfDate: string,
  weeks = DEFAULT_FORECAST_HORIZON,
): string[] {
  const currentWeekStart = startOfWeekUtc(asOfDate);
  const periods: string[] = [];
  for (let i = 1; i <= weeks; i++) {
    const weekStart = addDaysUtc(currentWeekStart, 7 * i);
    periods.push(toIsoWeek(weekStart));
  }
  return periods;
}

export function isInflowCategory(category: RollingBudgetCategory): boolean {
  return INFLOW_CATEGORIES.includes(category);
}

export function categoryToCashFlow(category: RollingBudgetCategory, amount: number): {
  inflow: number;
  outflow: number;
} {
  const magnitude = Math.abs(amount);
  if (isInflowCategory(category)) {
    return { inflow: magnitude, outflow: 0 };
  }
  return { inflow: 0, outflow: magnitude };
}

/** Weekly actuals may be signed (e.g. expenses negative) — forecast uses positive magnitudes. */
export function cashFlowMagnitude(category: RollingBudgetCategory, amount: number): number {
  return Math.abs(amount);
}

/** Sum amounts by period and category from flat rows. */
export function aggregateWeeklyRows(
  rows: WeeklyAmountRow[],
): Map<string, Map<RollingBudgetCategory, number>> {
  const byPeriod = new Map<string, Map<RollingBudgetCategory, number>>();
  for (const row of rows) {
    const periodMap = byPeriod.get(row.period) ?? new Map<RollingBudgetCategory, number>();
    periodMap.set(row.category, (periodMap.get(row.category) ?? 0) + row.amount);
    byPeriod.set(row.period, periodMap);
  }
  return byPeriod;
}

/**
 * Rolling average over the most recent `lookbackWeeks` of actuals (1–4).
 * Uses only weeks that have data, ordered by period.
 */
export function computeRollingAverage(
  rows: WeeklyAmountRow[],
  lookbackWeeks: number,
  asOfDate: string,
): RollingAverageResult {
  const clampedLookback = Math.min(4, Math.max(1, lookbackWeeks));
  const pastPeriods = getPastWeekPeriods(asOfDate, ROLLING_ACTUALS_WEEKS);
  const byPeriod = aggregateWeeklyRows(rows);

  const periodsWithData = pastPeriods.filter((p) => byPeriod.has(p));
  const sourcePeriods = periodsWithData.slice(-clampedLookback);

  const byCategory: Record<RollingBudgetCategory, number> = {
    revenue: 0,
    payroll: 0,
    expenses: 0,
    capex: 0,
    loan_repayment: 0,
  };

  if (sourcePeriods.length === 0) {
    return {
      avgInflows: 0,
      avgOutflows: 0,
      byCategory,
      lookbackWeeks: clampedLookback,
      sourcePeriods: [],
    };
  }

  for (const period of sourcePeriods) {
    const cats = byPeriod.get(period)!;
    for (const [cat, amount] of cats) {
      byCategory[cat] += cashFlowMagnitude(cat, amount);
    }
  }

  const divisor = sourcePeriods.length;
  for (const cat of Object.keys(byCategory) as RollingBudgetCategory[]) {
    byCategory[cat] = round2(byCategory[cat] / divisor);
  }

  const avgInflows = byCategory.revenue;
  const avgOutflows = round2(
    byCategory.payroll + byCategory.expenses + byCategory.capex + byCategory.loan_repayment,
  );

  return {
    avgInflows,
    avgOutflows,
    byCategory,
    lookbackWeeks: clampedLookback,
    sourcePeriods,
  };
}

/** Build per-week forecast adjustments from rolling actual averages. */
export function buildRollingForecastAdjustments(
  rows: WeeklyAmountRow[],
  lookbackWeeks: number,
  asOfDate: string,
  horizonWeeks = DEFAULT_FORECAST_HORIZON,
): Array<{ weekIndex: number; inflows: number; outflows: number }> {
  const horizon = clampForecastHorizon(horizonWeeks);
  const avg = computeRollingAverage(rows, lookbackWeeks, asOfDate);
  return Array.from({ length: horizon }, (_, i) => ({
    weekIndex: i + 1,
    inflows: avg.avgInflows,
    outflows: avg.avgOutflows,
  }));
}

type RollingBudgetLine = {
  period: string;
  category: RollingBudgetCategory;
  budgetAmount: number;
  budgetType: string;
};

function buildForwardBudgetFromAverage(
  avg: RollingAverageResult,
  asOfDate: string,
  budgetType: string,
): RollingBudgetLine[] {
  const futurePeriods = getFutureWeekPeriods(asOfDate, DEFAULT_FORECAST_HORIZON);
  const lines: RollingBudgetLine[] = [];
  for (const period of futurePeriods) {
    for (const cat of Object.keys(avg.byCategory) as RollingBudgetCategory[]) {
      const amount = avg.byCategory[cat];
      if (amount <= 0) continue;
      lines.push({ period, category: cat, budgetAmount: amount, budgetType });
    }
  }
  return lines;
}

/** Rolling budget for the next 13 weeks from recent actual averages. */
export function buildRollingBudgetLines(
  rows: WeeklyAmountRow[],
  lookbackWeeks: number,
  asOfDate: string,
  budgetType = 'rolling_auto',
): RollingBudgetLine[] {
  const avg = computeRollingAverage(rows, lookbackWeeks, asOfDate);
  return buildForwardBudgetFromAverage(avg, asOfDate, budgetType);
}

/** Rolling budget for the next 13 weeks derived from prior-period budget (when no forward upload). */
export function buildRollingBudgetFromPrior(
  priorBudgetRows: WeeklyAmountRow[],
  lookbackWeeks: number,
  asOfDate: string,
  budgetType = 'rolling_auto',
): RollingBudgetLine[] {
  const avg = computeRollingAverage(priorBudgetRows, lookbackWeeks, asOfDate);
  return buildForwardBudgetFromAverage(avg, asOfDate, budgetType);
}

export interface RollingVarianceLine {
  period: string;
  category: RollingBudgetCategory;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePercent: number | null;
}

/** Compare uploaded budget vs actuals for the past 14-week window. */
export function computeRollingVariance(
  budgetRows: WeeklyAmountRow[],
  actualRows: WeeklyAmountRow[],
  asOfDate: string,
): RollingVarianceLine[] {
  const window = new Set(getPastWeekPeriods(asOfDate));
  const budgetByKey = new Map<string, number>();
  const actualByKey = new Map<string, number>();

  const key = (period: string, category: string) => `${period}|${category}`;

  for (const row of budgetRows) {
    if (!window.has(row.period)) continue;
    const k = key(row.period, row.category);
    budgetByKey.set(k, (budgetByKey.get(k) ?? 0) + row.amount);
  }
  for (const row of actualRows) {
    if (!window.has(row.period)) continue;
    const k = key(row.period, row.category);
    actualByKey.set(k, (actualByKey.get(k) ?? 0) + row.amount);
  }

  const allKeys = new Set([...budgetByKey.keys(), ...actualByKey.keys()]);
  const lines: RollingVarianceLine[] = [];

  for (const k of [...allKeys].sort()) {
    const [period, category] = k.split('|') as [string, RollingBudgetCategory];
    const budgetAmount = round2(budgetByKey.get(k) ?? 0);
    const actualAmount = round2(actualByKey.get(k) ?? 0);
    const varianceAmount = computeBudgetVarianceAmount(category, budgetAmount, actualAmount);
    const variancePercent = computeBudgetVariancePercent(category, budgetAmount, varianceAmount);
    lines.push({
      period,
      category,
      budgetAmount,
      actualAmount,
      varianceAmount,
      variancePercent,
    });
  }

  return lines;
}

/** Monday of the ISO week period (approximation aligned with toIsoWeek). */
export function periodToWeekStart(period: string): string {
  const match = period.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return period;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - day + 1);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
