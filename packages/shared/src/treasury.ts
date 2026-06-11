export type LiquidityStatus = 'healthy' | 'moderate' | 'high_risk' | 'critical';

export interface WeeklyForecastLine {
  weekIndex: number;
  weekStart: string;
  openingCash: number;
  forecastInflows: number;
  forecastOutflows: number;
  closingCash: number;
  liquidityStatus: LiquidityStatus;
}

export interface TreasuryKpiSnapshot {
  currentCash: number;
  week13ClosingCash: number;
  weeklyNetBurn: number;
  runwayWeeks: number;
  liquidityStatus: LiquidityStatus;
  currency: string;
}

export const LIQUIDITY_THRESHOLDS = {
  healthyMinWeeks: 16,
  moderateMinWeeks: 8,
  highRiskMinWeeks: 4,
} as const;

export const AR_COLLECTION_WEIGHTS = {
  within30Days: 0.7,
  within60Days: 0.2,
  beyond90Days: 0.1,
} as const;

export const AP_PAYMENT_PRIORITY_ORDER = [
  'payroll',
  'tax',
  'critical',
  'flexible',
  'non_essential',
] as const;

export type ApPaymentPriority = (typeof AP_PAYMENT_PRIORITY_ORDER)[number];

export const DEFAULT_FORECAST_HORIZON = 13;
export const FORECAST_HORIZON_MIN = 1;
export const FORECAST_HORIZON_MAX = 26;

/** @deprecated Use DEFAULT_FORECAST_HORIZON */
export const FORECAST_WEEKS = DEFAULT_FORECAST_HORIZON;

export function clampForecastHorizon(weeks: number): number {
  return Math.min(FORECAST_HORIZON_MAX, Math.max(FORECAST_HORIZON_MIN, Math.round(weeks)));
}

export interface ForecastReceivableInput {
  outstandingAmount: number;
  invoiceDate: string;
  /** When set, AR is scheduled into the forecast week containing this due date. */
  dueDate?: string;
}

export interface ForecastPayableInput {
  outstandingAmount: number;
  dueDate: string;
  supplierPriority: ApPaymentPriority;
}

export interface ForecastCalculationInput {
  asOfDate: string;
  openingCash: number;
  receivables: ForecastReceivableInput[];
  payables: ForecastPayableInput[];
  /** Optional extra inflows/outflows per week index (1–13). */
  weeklyAdjustments?: Array<{ weekIndex: number; inflows?: number; outflows?: number }>;
  weeklyActuals?: Array<{
    period: string;
    category: string;
    amount: number;
    accountCode?: string;
  }>;
  forecastLookbackWeeks?: number;
  horizonWeeks?: number;
}

export interface ScenarioVariables {
  revenueDeclinePercent: number;
  payrollIncreasePercent: number;
  receivableDelayDays: number;
  expenseGrowthPercent: number;
}

/** Apply scenario sliders to baseline forecast inputs (returns a new input). */
export function applyScenarioToInput(
  input: ForecastCalculationInput,
  vars: ScenarioVariables,
): ForecastCalculationInput {
  const revenueFactor = 1 - clampPercent(vars.revenueDeclinePercent) / 100;
  const payrollFactor = 1 + clampPercent(vars.payrollIncreasePercent) / 100;
  const expenseFactor = 1 + clampPercent(vars.expenseGrowthPercent) / 100;
  const delayDays = Math.max(0, Math.round(vars.receivableDelayDays));

  return {
    ...input,
    receivables: input.receivables.map((r) => ({
      outstandingAmount: r.outstandingAmount * revenueFactor,
      invoiceDate: shiftIsoDate(r.invoiceDate, delayDays),
      dueDate: r.dueDate ? shiftIsoDate(r.dueDate, delayDays) : undefined,
    })),
    payables: input.payables.map((p) => ({
      ...p,
      outstandingAmount:
        p.outstandingAmount * (p.supplierPriority === 'payroll' ? payrollFactor : expenseFactor),
    })),
  };
}

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(Math.max(n, 0), 100);
}

function shiftIsoDate(iso: string, days: number): string {
  if (days === 0) return iso;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface TreasuryAlertParams {
  amount?: number;
  weeks?: number;
  weekIndex?: number;
  horizonWeeks?: number;
  status?: LiquidityStatus;
  /** Week-N closing cash alert (distinct from projected negative cash in a week). */
  closing?: boolean;
  /** Free-cash alert variant. */
  kind?: 'negative' | 'low';
}

export interface TreasuryAlert {
  alertType:
    | 'runway'
    | 'negative_cash'
    | 'delayed_collection'
    | 'liquidity_stress'
    | 'upcoming_obligation'
    | 'free_cash_risk';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  weekIndex?: number;
  params?: TreasuryAlertParams;
}
