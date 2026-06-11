import { formatCurrency } from './format-currency';
import { AR_COLLECTION_WEIGHTS, LIQUIDITY_THRESHOLDS, LiquidityStatus } from './treasury';

/** Alias for classifyLiquidity — returns liquidity band from runway weeks. */
export function getLiquidityBand(runwayWeeks: number | null): LiquidityStatus {
  if (runwayWeeks === null) return 'healthy';
  if (runwayWeeks <= 0) return 'critical';
  if (runwayWeeks > LIQUIDITY_THRESHOLDS.healthyMinWeeks) return 'healthy';
  if (runwayWeeks >= LIQUIDITY_THRESHOLDS.moderateMinWeeks) return 'moderate';
  if (runwayWeeks >= LIQUIDITY_THRESHOLDS.highRiskMinWeeks) return 'high_risk';
  return 'critical';
}

export interface ArCollectionBucket {
  bucket: 'within30' | 'within60' | 'beyond90';
  weight: number;
  amount: number;
}

/** 70/20/10 weighted AR collection schedule by invoice age. */
export function calcARCollectionSchedule(
  receivables: Array<{ outstandingAmount: number; invoiceDate: string }>,
  asOfDate: string,
): ArCollectionBucket[] {
  const buckets = { within30: 0, within60: 0, beyond90: 0 };

  for (const r of receivables) {
    if (r.outstandingAmount <= 0) continue;
    const age = daysBetween(r.invoiceDate, asOfDate);
    if (age <= 30) buckets.within30 += r.outstandingAmount;
    else if (age <= 60) buckets.within60 += r.outstandingAmount;
    else buckets.beyond90 += r.outstandingAmount;
  }

  return [
    { bucket: 'within30', weight: AR_COLLECTION_WEIGHTS.within30Days, amount: buckets.within30 },
    { bucket: 'within60', weight: AR_COLLECTION_WEIGHTS.within60Days, amount: buckets.within60 },
    { bucket: 'beyond90', weight: AR_COLLECTION_WEIGHTS.beyond90Days, amount: buckets.beyond90 },
  ];
}

export type TransactionCategoryKey =
  | 'payroll'
  | 'supplier'
  | 'customer'
  | 'tax'
  | 'loan'
  | 'other';

const CATEGORY_PATTERNS: Array<{ key: TransactionCategoryKey; pattern: RegExp }> = [
  { key: 'payroll', pattern: /payroll|salary|wages|pension/i },
  { key: 'tax', pattern: /tax|hmrc|vat|irs/i },
  { key: 'customer', pattern: /invoice|receipt|payment from|customer|client/i },
  { key: 'supplier', pattern: /supplier|vendor|purchase|materials|subcontract/i },
  { key: 'loan', pattern: /loan|mortgage|interest|finance/i },
];

export function categorizeTransaction(description: string | null | undefined): TransactionCategoryKey {
  const text = description ?? '';
  for (const { key, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return key;
  }
  return 'other';
}

/** @deprecated Use formatCurrency(value, currency, { compact: true }) */
export function formatCompactMoney(currency: string, value: number): string {
  return formatCurrency(value, currency, { compact: true });
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
