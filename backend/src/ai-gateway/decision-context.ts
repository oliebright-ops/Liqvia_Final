import type { TreasuryAiContext, TreasuryAiTransaction } from '../ai/ai-context';
import type { AiPayload } from './payload-schema';
import { CounterpartyRegistry } from './pseudonymise';
import { redactFreeText, safeLabel } from './redaction';

/**
 * Deterministic projection from Liqvia's internal treasury context to the
 * allowlisted AI payload.
 *
 * This is the step that makes the privacy refactor cost nothing in answer quality.
 * The naive version of "stop sending PII" is to send five totals, which produces a
 * model that can only restate the dashboard. Instead, everything that made the old
 * payload useful is preserved in structural form:
 *
 * | Signal the model needs            | How it survives                                  |
 * | --------------------------------- | ------------------------------------------------ |
 * | Customer A vs Customer B          | distinct stable `counterpartyCode`               |
 * | Which receivable is critical      | `cashImpact` + `shareOfTotalPct` + `dueWeek`     |
 * | Concentration risk                | `topConcentrationPct` + per-item shares          |
 * | Payment timing                    | `dueWeek` relative to `asOfDate`                 |
 * | Recurring vs one-off              | `isRecurring` + `cadenceDays`                    |
 * | What kind of money moved          | `cashFlowCategories` from local classification   |
 * | Overdue vs current                | `status` + `daysOverdue` + `collectionConfidence`|
 * | Scenario reasoning                | `scenario` deltas + `assumptions`                |
 *
 * What does not survive, by design: names, narratives, contact details, account
 * numbers, document text, raw rows.
 *
 * Nothing here is a forecast. Every number is copied from what the deterministic
 * engine already computed; this module reshapes, buckets and pseudonymises.
 */

const MS_PER_DAY = 86_400_000;

export interface BuildPayloadOptions {
  companyId: string;
  context: TreasuryAiContext;
  locale?: string;
  question?: string;
  scenario?: {
    baseline: { week13ClosingCash: number | null; runwayWeeks: number | null };
    scenario: { week13ClosingCash: number | null; runwayWeeks: number | null };
    delta: { week13ClosingCash: number | null; runwayWeeks: number | null };
  } | null;
  movements?: Array<{
    label: string;
    current: number;
    previous: number;
    delta: number;
    percentChange: number | null;
    currentPeriod: string;
    previousPeriod: string;
  }>;
}

export interface BuiltPayload {
  payload: AiPayload;
  registry: CounterpartyRegistry;
  /** Counts of what redaction removed from the free-text question. No values. */
  redactionCounts: Record<string, number>;
}

export function buildAiPayload(options: BuildPayloadOptions): BuiltPayload {
  const { context: c, companyId } = options;
  const registry = new CounterpartyRegistry(companyId);
  const asOf = c.asOfDate;

  const arTotal = sum(c.receivablesDetail.map((r) => r.amount));
  const apTotal = sum(c.payablesDetail.map((p) => p.amount));

  const receivableItems = c.receivablesDetail.map((r) => ({
    counterpartyCode: registry.code('CUSTOMER', r.counterparty),
    amount: round2(r.amount),
    dueWeek: weekIndexOf(r.dueDate, asOf),
    daysOverdue: clampInt(r.daysOverdue, 0, 10_000),
    status: (r.daysOverdue > 0 ? 'overdue' : 'open') as 'open' | 'overdue',
    shareOfTotalPct: pct(r.amount, arTotal),
    collectionConfidence: collectionConfidence(r.daysOverdue),
    cashImpact: cashImpact(r.amount, c.currentCash, c.weeklyBurn),
  }));

  const payableItems = c.payablesDetail.map((p) => ({
    counterpartyCode: registry.code('SUPPLIER', p.counterparty),
    amount: round2(p.amount),
    dueWeek: weekIndexOf(p.dueDate, asOf),
    daysOverdue: clampInt(p.daysOverdue, 0, 10_000),
    status: (p.daysOverdue > 0 ? 'overdue' : 'open') as 'open' | 'overdue',
    shareOfTotalPct: pct(p.amount, apTotal),
    priority: normalisePriority(p.supplierPriority),
    cashImpact: cashImpact(p.amount, c.currentCash, c.weeklyBurn),
  }));

  const payload: AiPayload = {
    meta: {
      asOfDate: asOf,
      currency: c.currency,
      locale: normaliseLocale(options.locale),
      ...(isBusinessMode(c.businessMode) ? { businessMode: c.businessMode } : {}),
      ...(c.industry ? { sector: safeLabel(c.industry, 40) } : {}),
    },
    liquidity: {
      openingCash: round2(c.currentCash),
      week13ClosingCash: nullableRound(c.week13ClosingCash),
      runwayWeeks: nullableRound(c.runwayWeeks),
      weeklyBurn: round2(c.weeklyBurn),
      liquidityStatus: normaliseLiquidityStatus(c.liquidityStatus),
      // Liqvia has no explicit configured buffer yet; the free-cash figure is the
      // closest true equivalent. Sent as null rather than invented when absent.
      minimumCashBuffer: c.freeAvailableCash === undefined ? null : round2(c.freeAvailableCash),
      ...(c.freeAvailableCash !== undefined ? { freeAvailableCash: round2(c.freeAvailableCash) } : {}),
      ...(c.fixedOutflowsHorizon !== undefined
        ? { fixedOutflowsHorizon: round2(c.fixedOutflowsHorizon) }
        : {}),
      ...(c.horizonWeeks !== undefined ? { horizonWeeks: clampInt(c.horizonWeeks, -520, 520) } : {}),
    },
    weeks: c.forecastWeeks.slice(0, 53).map((w) => ({
      weekIndex: clampInt(w.weekIndex, -520, 520),
      openingCash: round2(w.openingCash),
      inflows: round2(w.inflows),
      outflows: round2(w.outflows),
      closingCash: round2(w.closingCash),
    })),
    receivables: {
      total: round2(arTotal),
      overdueTotal: round2(c.overdueReceivables),
      dueNext30Days: nullableRound(c.arDue30Days),
      delayedOver90Days: nullableRound(c.arDelayed90Days),
      count: receivableItems.length,
      topConcentrationPct: topConcentration(receivableItems),
      items: receivableItems.slice(0, 30),
    },
    payables: {
      total: round2(apTotal),
      overdueTotal: round2(c.apOverdue),
      count: payableItems.length,
      topConcentrationPct: topConcentration(payableItems),
      items: payableItems.slice(0, 30),
    },
    obligations: c.recurringObligations.slice(0, 40).map((o) => ({
      obligationCode: registry.code('OBLIGATION', o.name),
      category: normaliseObligationCategory(o.category),
      amount: round2(o.amount),
      frequency: normaliseFrequency(o.frequency),
      dueWeek: weekIndexOf(o.dueDate, asOf),
      isRecurring: normaliseFrequency(o.frequency) !== 'one_off',
      confidence: normaliseConfidence(o.confidence),
    })),
    cashFlowCategories: summariseCashFlow(c.cashTransactions),
    budget: c.budgetLines.slice(0, 25).map((l) => ({
      period: safeLabel(l.period, 20),
      category: safeLabel(l.category, 60),
      budgetAmount: round2(l.budgetAmount),
      actualAmount: round2(l.actualAmount),
      varianceAmount: round2(l.varianceAmount),
      variancePercent: nullableRound(l.variancePercent),
    })),
    // Alert *messages* are dropped: they are assembled from customer data and have
    // previously embedded counterparty names. Type and severity carry the signal.
    alerts: c.alerts.slice(0, 20).map((a) => ({
      type: safeLabel(a.type, 40),
      severity: normaliseSeverity(a.severity),
    })),
    dataCoverage: {
      bankTransactions: c.dataModules.bankTransactions,
      receivables: c.dataModules.receivables,
      payables: c.dataModules.payables,
      budgetLines: c.dataModules.budgetLines,
      forecastWeeks: c.dataModules.forecastWeeks,
    },
  };

  if (c.payrollReadiness) {
    payload.payroll = {
      nextPayrollWeek: c.payrollReadiness.nextPayrollDate
        ? weekIndexOf(c.payrollReadiness.nextPayrollDate, asOf)
        : null,
      expectedAmount: round2(c.payrollReadiness.expectedPayrollAmount),
      availableCash: round2(c.payrollReadiness.availablePayrollCash),
      bufferAfterPayroll: round2(c.payrollReadiness.bufferAfterPayroll),
      status: c.payrollReadiness.status ? safeLabel(c.payrollReadiness.status, 40) : null,
    };
  }

  if (c.cashByPurpose) {
    payload.cashByPurpose = {
      totalCash: round2(c.cashByPurpose.totalCash),
      payrollReserve: round2(c.cashByPurpose.payrollReserve),
      taxReserve: round2(c.cashByPurpose.taxReserve),
      emergencyReserve: round2(c.cashByPurpose.emergencyReserve),
      restrictedOrClearingFunds: round2(c.cashByPurpose.restrictedOrClearingFunds),
      knownUpcomingObligations: round2(c.cashByPurpose.knownUpcomingObligations),
      availableToSpend: round2(c.cashByPurpose.availableToSpend),
    };
  }

  if (c.dataQuality) {
    payload.dataQuality = {
      score: clampNumber(c.dataQuality.score, 0, 100),
      warningCount: c.dataQuality.warnings.length,
    };
  }

  if (options.scenario) {
    const s = options.scenario;
    payload.scenario = {
      baselineWeek13ClosingCash: nullableRound(s.baseline.week13ClosingCash),
      scenarioWeek13ClosingCash: nullableRound(s.scenario.week13ClosingCash),
      deltaWeek13ClosingCash: nullableRound(s.delta.week13ClosingCash),
      baselineRunwayWeeks: nullableRound(s.baseline.runwayWeeks),
      scenarioRunwayWeeks: nullableRound(s.scenario.runwayWeeks),
      deltaRunwayWeeks: nullableRound(s.delta.runwayWeeks),
      assumptions: [],
    };
  }

  if (options.movements?.length) {
    payload.movements = options.movements.slice(0, 12).map((m) => ({
      label: safeLabel(m.label, 60),
      current: round2(m.current),
      previous: round2(m.previous),
      delta: round2(m.delta),
      percentChange: nullableRound(m.percentChange),
      currentPeriod: safeLabel(m.currentPeriod, 20),
      previousPeriod: safeLabel(m.previousPeriod, 20),
    }));
  }

  let redactionCounts: Record<string, number> = {};
  if (options.question?.trim()) {
    // Registry is fully populated by this point, so a question naming a customer
    // gets that customer's code rather than a blanket placeholder.
    const redacted = redactFreeText(options.question, registry);
    redactionCounts = redacted.removed;
    payload.question = {
      category: c.queryAnalysis?.intent ?? 'general',
      redactedText: redacted.text,
      ...(c.queryAnalysis?.horizonMonths !== undefined
        ? { horizonMonths: clampInt(c.queryAnalysis.horizonMonths, 0, 120) }
        : {}),
    };
  }

  return { payload, registry, redactionCounts };
}

/**
 * Local classification of bank movements into category aggregates.
 *
 * This is the replacement for sending narratives. `categorizeTransaction` has
 * already run over each description inside Liqvia; only its verdict travels.
 * Cadence is inferred from the spacing of dates within a category so the model can
 * still tell a recurring obligation from a one-off payment.
 */
function summariseCashFlow(transactions: TreasuryAiTransaction[]): AiPayload['cashFlowCategories'] {
  const buckets = new Map<string, { total: number; count: number; dates: number[]; category: string; direction: 'IN' | 'OUT' }>();

  for (const t of transactions) {
    const category = normaliseTransactionCategory(t.category);
    const key = `${category}:${t.direction}`;
    const bucket = buckets.get(key) ?? {
      total: 0,
      count: 0,
      dates: [],
      category,
      direction: t.direction,
    };
    bucket.total += Math.abs(t.amount);
    bucket.count += 1;
    const time = Date.parse(t.date);
    if (!Number.isNaN(time)) bucket.dates.push(time);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 24)
    .map((b) => {
      const cadence = medianCadenceDays(b.dates);
      return {
        category: b.category as AiPayload['cashFlowCategories'][number]['category'],
        direction: b.direction,
        total: round2(b.total),
        count: b.count,
        averageAmount: round2(b.count > 0 ? b.total / b.count : 0),
        cadenceDays: cadence,
        isRecurring: cadence !== null && b.count >= 3,
      };
    });
}

/** Median gap between consecutive occurrences, or null when there is no pattern. */
function medianCadenceDays(times: number[]): number | null {
  if (times.length < 3) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const days = Math.round((sorted[i]! - sorted[i - 1]!) / MS_PER_DAY);
    if (days > 0) gaps.push(days);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  return median >= 1 && median <= 400 ? median : null;
}

/**
 * Materiality bucket. Deterministic and explainable — the model is told the rule in
 * the system prompt so it never has to guess what CRITICAL means.
 */
function cashImpact(
  amount: number,
  currentCash: number,
  weeklyBurn: number,
): 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' {
  const abs = Math.abs(amount);
  const vsCash = currentCash > 0 ? abs / currentCash : abs > 0 ? Infinity : 0;
  const vsBurn = weeklyBurn > 0 ? abs / weeklyBurn : 0;
  if (vsCash >= 0.25 || vsBurn >= 4) return 'CRITICAL';
  if (vsCash >= 0.1 || vsBurn >= 2) return 'HIGH';
  if (vsCash >= 0.03 || vsBurn >= 0.5) return 'MODERATE';
  return 'LOW';
}

/** Ageing-based likelihood of collection. A heuristic, and labelled as one. */
function collectionConfidence(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0.9;
  if (daysOverdue <= 30) return 0.75;
  if (daysOverdue <= 60) return 0.55;
  if (daysOverdue <= 90) return 0.35;
  return 0.2;
}

function topConcentration(items: Array<{ shareOfTotalPct: number }>): number {
  return items.reduce((max, i) => Math.max(max, i.shareOfTotalPct), 0);
}

function weekIndexOf(dateIso: string, asOfDate: string): number {
  const target = Date.parse(dateIso);
  const base = Date.parse(asOfDate);
  if (Number.isNaN(target) || Number.isNaN(base)) return 0;
  return clampInt(Math.floor((target - base) / MS_PER_DAY / 7), -520, 520);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return round2((part / total) * 100);
}

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function nullableRound(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : round2(value);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value || 0)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

// --- Vocabulary normalisers ------------------------------------------------
// Each maps a value that could in principle be arbitrary onto a closed set, so a
// surprising value from the database becomes 'other' rather than a free string.

function normaliseLocale(locale?: string): 'en' | 'es' | 'fr' | 'ru' {
  return locale === 'ru' || locale === 'es' || locale === 'fr' ? locale : 'en';
}

function isBusinessMode(mode?: string): mode is 'invoice_driven' | 'cash_driven' | 'mixed' {
  return mode === 'invoice_driven' || mode === 'cash_driven' || mode === 'mixed';
}

function normaliseLiquidityStatus(
  status: string,
): 'healthy' | 'moderate' | 'high_risk' | 'critical' {
  return status === 'healthy' || status === 'moderate' || status === 'high_risk' || status === 'critical'
    ? status
    : 'moderate';
}

function normaliseSeverity(severity: string): 'info' | 'warning' | 'critical' {
  return severity === 'critical' || severity === 'warning' ? severity : 'info';
}

const TRANSACTION_CATEGORIES = new Set(['payroll', 'tax', 'customer', 'supplier', 'loan', 'other']);
function normaliseTransactionCategory(category: string): string {
  return TRANSACTION_CATEGORIES.has(category) ? category : 'other';
}

const OBLIGATION_CATEGORIES = new Set([
  'payroll',
  'superannuation',
  'payg_withholding',
  'gst_bas',
  'tax',
  'rent',
  'loan_repayment',
  'insurance',
  'subscription',
  'utilities',
  'vehicle',
  'merchant_fees',
  'other',
]);
function normaliseObligationCategory(category: string): AiPayload['obligations'][number]['category'] {
  return (
    OBLIGATION_CATEGORIES.has(category) ? category : 'other'
  ) as AiPayload['obligations'][number]['category'];
}

const FREQUENCIES = new Set(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']);
function normaliseFrequency(frequency: string): AiPayload['obligations'][number]['frequency'] {
  return (
    FREQUENCIES.has(frequency) ? frequency : 'one_off'
  ) as AiPayload['obligations'][number]['frequency'];
}

function normaliseConfidence(confidence?: string | null): 'high' | 'medium' | 'low' | null {
  return confidence === 'high' || confidence === 'medium' || confidence === 'low'
    ? confidence
    : null;
}

const PRIORITIES = new Set(['payroll', 'tax', 'critical', 'flexible', 'non_essential']);
function normalisePriority(priority?: string): AiPayload['payables']['items'][number]['priority'] {
  return (
    priority && PRIORITIES.has(priority) ? priority : 'unknown'
  ) as AiPayload['payables']['items'][number]['priority'];
}
