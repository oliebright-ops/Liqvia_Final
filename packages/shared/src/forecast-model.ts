import {
  clampForecastHorizon,
  DEFAULT_FORECAST_HORIZON,
  LIQUIDITY_THRESHOLDS,
  LiquidityStatus,
  WeeklyForecastLine,
} from './treasury';
import { buildRollingForecastAdjustments, type WeeklyAmountRow } from './rolling-budget';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ForecastLedgerReceivable {
  id: string;
  counterparty: string;
  dueDate: string;
  outstandingAmount: number;
}

export interface ForecastLedgerPayable {
  id: string;
  counterparty: string;
  dueDate: string;
  outstandingAmount: number;
}

export interface ForecastArApEntry {
  id: string;
  type: 'receivable' | 'payable';
  counterparty: string;
  dueDate: string;
  amount: number;
  weekIndex: number;
}

export interface WeeklyForecastDetail extends WeeklyForecastLine {
  arApInflows: number;
  arApOutflows: number;
  netCashFlow: number;
  entries: ForecastArApEntry[];
}

export interface ForecastModelInput {
  asOfDate: string;
  openingCash: number;
  receivables: ForecastLedgerReceivable[];
  payables: ForecastLedgerPayable[];
  /** Forecast horizon in weeks (1–26, default 13). */
  horizonWeeks?: number;
  weeklyAdjustments?: Array<{ weekIndex: number; inflows?: number; outflows?: number }>;
  /** Past weekly actuals — drives rolling forecast from 1–4 week average. */
  weeklyActuals?: WeeklyAmountRow[];
  forecastLookbackWeeks?: number;
}

export interface ForecastModelResult {
  weeks: WeeklyForecastDetail[];
  horizonWeeks: number;
  openingCash: number;
  projectedClosing: number | null;
  week13ClosingCash: number | null;
  runwayWeeks: number | null;
  weeklyNetBurn: number;
  executiveLiquidity: LiquidityStatus;
}

export function startOfWeekUtc(isoDate: string): string {
  const d = parseDateUtc(isoDate);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatDateUtc(d);
}

/** Calendar week index from forecast start (1-based, not capped). */
export function naturalDateToWeekIndex(forecastStartIso: string, targetIso: string): number {
  const start = parseDateUtc(forecastStartIso);
  const target = parseDateUtc(targetIso);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/** Week bucket within an N-week forecast grid (caps at horizon). */
export function dateToWeekIndex(
  forecastStartIso: string,
  targetIso: string,
  horizonWeeks: number,
): number {
  return Math.min(naturalDateToWeekIndex(forecastStartIso, targetIso), horizonWeeks);
}

/** Week index for scheduling, or null when due date falls beyond the horizon. */
export function resolveScheduleWeekIndex(
  asOfDate: string,
  dueDate: string,
  horizonWeeks: number,
): number | null {
  if (dueDate < asOfDate) return 1;
  const forecastStart = startOfWeekUtc(asOfDate);
  const naturalWeek = naturalDateToWeekIndex(forecastStart, dueDate);
  if (naturalWeek > horizonWeeks) return null;
  return naturalWeek;
}

/** Schedule AR/AP by due date; overdue items land in week 1. */
export function scheduleArApEntries(input: ForecastModelInput): {
  entries: ForecastArApEntry[];
  arByWeek: number[];
  apByWeek: number[];
} {
  const horizonWeeks = clampForecastHorizon(input.horizonWeeks ?? DEFAULT_FORECAST_HORIZON);
  const forecastStart = startOfWeekUtc(input.asOfDate);
  const arByWeek = Array(horizonWeeks).fill(0);
  const apByWeek = Array(horizonWeeks).fill(0);
  const entries: ForecastArApEntry[] = [];

  for (const ar of input.receivables) {
    if (ar.outstandingAmount <= 0) continue;
    const weekIndex = resolveScheduleWeekIndex(input.asOfDate, ar.dueDate, horizonWeeks);
    if (weekIndex === null) continue;
    arByWeek[weekIndex - 1] += ar.outstandingAmount;
    entries.push({
      id: ar.id,
      type: 'receivable',
      counterparty: ar.counterparty,
      dueDate: ar.dueDate,
      amount: ar.outstandingAmount,
      weekIndex,
    });
  }

  for (const ap of input.payables) {
    if (ap.outstandingAmount <= 0) continue;
    const weekIndex = resolveScheduleWeekIndex(input.asOfDate, ap.dueDate, horizonWeeks);
    if (weekIndex === null) continue;
    apByWeek[weekIndex - 1] += ap.outstandingAmount;
    entries.push({
      id: ap.id,
      type: 'payable',
      counterparty: ap.counterparty,
      dueDate: ap.dueDate,
      amount: ap.outstandingAmount,
      weekIndex,
    });
  }

  return { entries, arByWeek, apByWeek };
}

export function averageWeeklyNetBurn(
  weeks: Array<{ forecastInflows: number; forecastOutflows: number }>,
): number {
  const burns = weeks.map((w) => w.forecastOutflows - w.forecastInflows).filter((b) => b > 0);
  if (burns.length === 0) return 0;
  return burns.reduce((sum, b) => sum + b, 0) / burns.length;
}

export function calculateRunwayWeeks(cash: number, weeklyNetBurn: number): number | null {
  if (weeklyNetBurn <= 0) return null;
  if (cash <= 0) return 0;
  return cash / weeklyNetBurn;
}

export function classifyLiquidity(runwayWeeks: number | null): LiquidityStatus {
  if (runwayWeeks === null) return 'healthy';
  if (runwayWeeks <= 0) return 'critical';
  if (runwayWeeks > LIQUIDITY_THRESHOLDS.healthyMinWeeks) return 'healthy';
  if (runwayWeeks >= LIQUIDITY_THRESHOLDS.moderateMinWeeks) return 'moderate';
  if (runwayWeeks >= LIQUIDITY_THRESHOLDS.highRiskMinWeeks) return 'high_risk';
  return 'critical';
}

/** Per-week liquidity from closing cash and forward net burn (aligned with closing balance). */
export function classifyWeekLiquidity(
  closingCash: number,
  remainingWeeks: Array<{ forecastInflows: number; forecastOutflows: number }>,
): LiquidityStatus {
  if (closingCash < 0) return 'critical';
  const forwardBurn = averageWeeklyNetBurn(remainingWeeks);
  const runway = calculateRunwayWeeks(closingCash, forwardBurn);
  return classifyLiquidity(runway);
}

export function resolveExecutiveLiquidity(
  openingCash: number,
  weeks: Array<{ weekIndex: number; closingCash: number }>,
  runwayWeeks: number | null,
  horizonWeeks: number,
): LiquidityStatus {
  const candidates: LiquidityStatus[] = [classifyLiquidity(runwayWeeks)];
  if (openingCash < 0) candidates.push('critical');

  const negativeWeeks = weeks.filter((w) => w.closingCash < 0);
  if (negativeWeeks.length > 0) {
    const first = Math.min(...negativeWeeks.map((w) => w.weekIndex));
    candidates.push(first <= 4 ? 'critical' : 'high_risk');
  }

  const horizonWeek = weeks.find((w) => w.weekIndex === horizonWeeks);
  if (horizonWeek && horizonWeek.closingCash < 0) candidates.push('critical');

  const rank: Record<LiquidityStatus, number> = {
    healthy: 0,
    moderate: 1,
    high_risk: 2,
    critical: 3,
  };
  return candidates.reduce((worst, s) => (rank[s] > rank[worst] ? s : worst));
}

/** Single source of truth: N-week cash forecast from opening cash + AR/AP due dates. */
export function buildForecastModel(input: ForecastModelInput): ForecastModelResult {
  const horizonWeeks = clampForecastHorizon(input.horizonWeeks ?? DEFAULT_FORECAST_HORIZON);
  const { arByWeek, apByWeek, entries } = scheduleArApEntries({
    ...input,
    horizonWeeks,
  });
  const forecastStart = startOfWeekUtc(input.asOfDate);

  const rollingAdjustments =
    input.weeklyActuals && input.weeklyActuals.length > 0
      ? buildRollingForecastAdjustments(
          input.weeklyActuals,
          input.forecastLookbackWeeks ?? 4,
          input.asOfDate,
          horizonWeeks,
        )
      : null;

  const rawWeeks: Omit<WeeklyForecastDetail, 'liquidityStatus'>[] = [];
  let openingCash = input.openingCash;

  for (let i = 0; i < horizonWeeks; i++) {
    const weekIndex = i + 1;
    const arApInflows = arByWeek[i];
    const arApOutflows = apByWeek[i];

    const rolling = rollingAdjustments?.find((a) => a.weekIndex === weekIndex);
    const manual = input.weeklyAdjustments?.find((a) => a.weekIndex === weekIndex);
    const inflows =
      cashMagnitude(arApInflows) +
      cashMagnitude(rolling?.inflows ?? 0) +
      cashMagnitude(manual?.inflows ?? 0);
    const outflows =
      cashMagnitude(arApOutflows) +
      cashMagnitude(rolling?.outflows ?? 0) +
      cashMagnitude(manual?.outflows ?? 0);
    const netCashFlow = inflows - outflows;
    const closingCash = openingCash + netCashFlow;

    rawWeeks.push({
      weekIndex,
      weekStart: addDaysUtc(forecastStart, i * 7),
      openingCash: round2(openingCash),
      arApInflows: round2(arApInflows),
      arApOutflows: round2(arApOutflows),
      forecastInflows: round2(inflows),
      forecastOutflows: round2(outflows),
      netCashFlow: round2(netCashFlow),
      closingCash: round2(closingCash),
      entries: entries.filter((e) => e.weekIndex === weekIndex),
    });

    openingCash = closingCash;
  }

  const weeks = rawWeeks.map((week, index) => ({
    ...week,
    liquidityStatus: classifyWeekLiquidity(
      week.closingCash,
      rawWeeks.slice(index).map((w) => ({
        forecastInflows: w.forecastInflows,
        forecastOutflows: w.forecastOutflows,
      })),
    ),
  }));

  const weeklyNetBurn = averageWeeklyNetBurn(weeks);
  const runwayWeeks = calculateRunwayWeeks(input.openingCash, weeklyNetBurn);
  const horizonClosing = weeks.find((w) => w.weekIndex === horizonWeeks);

  return {
    weeks,
    horizonWeeks,
    openingCash: input.openingCash,
    projectedClosing: horizonClosing?.closingCash ?? null,
    week13ClosingCash: horizonClosing?.closingCash ?? null,
    runwayWeeks: runwayWeeks === null ? null : round2(runwayWeeks),
    weeklyNetBurn: round2(weeklyNetBurn),
    executiveLiquidity: resolveExecutiveLiquidity(
      input.openingCash,
      weeks,
      runwayWeeks,
      horizonWeeks,
    ),
  };
}

function parseDateUtc(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function addDaysUtc(iso: string, days: number): string {
  const d = parseDateUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateUtc(d);
}

function formatDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Cash inflows/outflows are always positive magnitudes before net = inflows − outflows. */
function cashMagnitude(n: number): number {
  return Math.abs(n);
}
