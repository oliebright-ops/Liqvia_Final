import { z } from 'zod';

/**
 * The complete, exhaustive definition of what Liqvia is willing to send to an
 * external AI provider.
 *
 * This is an **allowlist**, not a blocklist. Every schema below is `.strict()`, so a
 * field that is not named here is not "stripped and forgotten" — it causes the
 * payload to be rejected outright. That distinction is the whole point: a blocklist
 * fails open when someone adds a new field upstream, an allowlist fails closed.
 *
 * Rules for editing this file:
 *  - Adding a field is a privacy decision, not a refactor. It needs the same review
 *    as a schema migration.
 *  - Never add a free-string field for a human-readable name, description, narrative
 *    or address. Identity belongs in `*_code` fields produced by
 *    `pseudonymise.ts`.
 *  - Never relax `.strict()`.
 *
 * The corresponding negative tests live in `ai-privacy-gateway.spec.ts` and
 * `ai-boundary.spec.ts`.
 */

/** Pseudonymous counterparty handles, e.g. CUSTOMER_C014. Never a real name. */
const counterpartyCode = z
  .string()
  .regex(
    /^(CUSTOMER|SUPPLIER|ACCOUNT|OBLIGATION|RECURRING)_(?:[CSAOR]\d{3}|[CSAOR][A-Z0-9]{1,8}|UNSPECIFIED)$/,
    'counterparty codes must be pseudonymous handles, never names',
  );

const money = z.number().finite();
const ratio = z.number().finite().min(-1000).max(1000);
const weekIndex = z.number().int().min(-520).max(520);

/** Closed vocabulary — derived by Liqvia's own classifier, never free text. */
export const TRANSACTION_CATEGORY = z.enum([
  'payroll',
  'tax',
  'customer',
  'supplier',
  'loan',
  'other',
]);

export const CASH_IMPACT = z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']);

export const QUESTION_CATEGORY = z.enum([
  'transaction_lookup',
  'outflow_summary',
  'inflow_summary',
  'payables',
  'receivables',
  'budget',
  'runway',
  'payroll',
  'cash_position',
  'risks',
  'expenses',
  'payment_advisory',
  'general',
]);

// --- Blocks ---------------------------------------------------------------

export const metaSchema = z
  .object({
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.string().length(3),
    locale: z.enum(['en', 'es', 'fr', 'ru']),
    businessMode: z.enum(['invoice_driven', 'cash_driven', 'mixed']).optional(),
    /** Broad sector only, from a controlled list — never the company's own name. */
    sector: z.string().max(40).optional(),
  })
  .strict();

export const liquiditySchema = z
  .object({
    openingCash: money,
    week13ClosingCash: money.nullable(),
    runwayWeeks: money.nullable(),
    weeklyBurn: money,
    liquidityStatus: z.enum(['healthy', 'moderate', 'high_risk', 'critical']),
    minimumCashBuffer: money.nullable(),
    freeAvailableCash: money.optional(),
    fixedOutflowsHorizon: money.optional(),
    horizonWeeks: weekIndex.optional(),
  })
  .strict();

export const weeklyCashSchema = z
  .object({
    weekIndex,
    openingCash: money,
    inflows: money,
    outflows: money,
    closingCash: money,
  })
  .strict();

export const receivableItemSchema = z
  .object({
    counterpartyCode: counterpartyCode,
    amount: money,
    dueWeek: weekIndex,
    daysOverdue: z.number().int().min(0).max(10_000),
    status: z.enum(['open', 'overdue']),
    /** Share of total AR, so the model can see concentration without seeing names. */
    shareOfTotalPct: ratio,
    collectionConfidence: z.number().min(0).max(1).nullable(),
    cashImpact: CASH_IMPACT,
  })
  .strict();

export const payableItemSchema = z
  .object({
    counterpartyCode: counterpartyCode,
    amount: money,
    dueWeek: weekIndex,
    daysOverdue: z.number().int().min(0).max(10_000),
    status: z.enum(['open', 'overdue']),
    shareOfTotalPct: ratio,
    priority: z.enum(['payroll', 'tax', 'critical', 'flexible', 'non_essential', 'unknown']),
    cashImpact: CASH_IMPACT,
  })
  .strict();

export const receivablesSchema = z
  .object({
    total: money,
    overdueTotal: money,
    dueNext30Days: money.nullable(),
    delayedOver90Days: money.nullable(),
    count: z.number().int().min(0),
    topConcentrationPct: ratio,
    items: z.array(receivableItemSchema).max(30),
  })
  .strict();

export const payablesSchema = z
  .object({
    total: money,
    overdueTotal: money,
    count: z.number().int().min(0),
    topConcentrationPct: ratio,
    items: z.array(payableItemSchema).max(30),
  })
  .strict();

export const obligationSchema = z
  .object({
    obligationCode: counterpartyCode,
    category: z.enum([
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
    ]),
    amount: money,
    frequency: z.enum([
      'weekly',
      'fortnightly',
      'monthly',
      'quarterly',
      'annually',
      'one_off',
    ]),
    dueWeek: weekIndex,
    isRecurring: z.boolean(),
    confidence: z.enum(['high', 'medium', 'low']).nullable(),
  })
  .strict();

/**
 * Bank narratives never leave Liqvia. Local classification turns them into these
 * aggregates, which carry the signal the model needs (what kind of money, which
 * direction, how much, how often) without the text.
 */
export const cashFlowCategorySchema = z
  .object({
    category: TRANSACTION_CATEGORY,
    direction: z.enum(['IN', 'OUT']),
    total: money,
    count: z.number().int().min(0),
    averageAmount: money,
    /** Present when the pattern repeats on a detectable cadence. */
    cadenceDays: z.number().int().min(1).max(400).nullable(),
    isRecurring: z.boolean(),
  })
  .strict();

export const budgetLineSchema = z
  .object({
    period: z.string().max(20),
    /** Sanitised label — categories originate from customer spreadsheets. */
    category: z.string().max(60),
    budgetAmount: money,
    actualAmount: money,
    varianceAmount: money,
    variancePercent: ratio.nullable(),
  })
  .strict();

export const payrollSchema = z
  .object({
    nextPayrollWeek: weekIndex.nullable(),
    expectedAmount: money,
    availableCash: money,
    bufferAfterPayroll: money,
    status: z.string().max(40).nullable(),
  })
  .strict();

export const cashByPurposeSchema = z
  .object({
    totalCash: money,
    payrollReserve: money,
    taxReserve: money,
    emergencyReserve: money,
    restrictedOrClearingFunds: money,
    knownUpcomingObligations: money,
    availableToSpend: money,
  })
  .strict();

export const scenarioSchema = z
  .object({
    baselineWeek13ClosingCash: money.nullable(),
    scenarioWeek13ClosingCash: money.nullable(),
    deltaWeek13ClosingCash: money.nullable(),
    baselineRunwayWeeks: money.nullable(),
    scenarioRunwayWeeks: money.nullable(),
    deltaRunwayWeeks: money.nullable(),
    assumptions: z.array(z.string().max(80)).max(12),
  })
  .strict();

export const alertSchema = z
  .object({
    type: z.string().max(40),
    severity: z.enum(['info', 'warning', 'critical']),
  })
  .strict();

export const movementSchema = z
  .object({
    /** Metric label from Liqvia's own KPI vocabulary, not customer data. */
    label: z.string().max(60),
    current: money,
    previous: money,
    delta: money,
    percentChange: ratio.nullable(),
    currentPeriod: z.string().max(20),
    previousPeriod: z.string().max(20),
  })
  .strict();

export const questionSchema = z
  .object({
    category: QUESTION_CATEGORY,
    /** Already passed through `redactFreeText`. */
    redactedText: z.string().max(1000),
    horizonMonths: z.number().int().min(0).max(120).optional(),
  })
  .strict();

export const dataQualitySchema = z
  .object({
    score: z.number().min(0).max(100),
    warningCount: z.number().int().min(0),
  })
  .strict();

export const dataCoverageSchema = z
  .object({
    bankTransactions: z.number().int().min(0),
    receivables: z.number().int().min(0),
    payables: z.number().int().min(0),
    budgetLines: z.number().int().min(0),
    forecastWeeks: z.number().int().min(0),
  })
  .strict();

// --- The payload ----------------------------------------------------------

/**
 * The only object shape that may be serialised to an external AI provider.
 *
 * Note what is absent and must stay absent: `companyName`, `companyId`, `userId`,
 * any `*Name`, `description`, `narrative`, `counterparty`, `email`, `phone`,
 * `address`, `accountNumber`, `rows`, `csv`, `documentText`.
 */
export const aiPayloadSchema = z
  .object({
    meta: metaSchema,
    liquidity: liquiditySchema,
    weeks: z.array(weeklyCashSchema).max(53),
    receivables: receivablesSchema,
    payables: payablesSchema,
    obligations: z.array(obligationSchema).max(40),
    cashFlowCategories: z.array(cashFlowCategorySchema).max(24),
    budget: z.array(budgetLineSchema).max(25),
    alerts: z.array(alertSchema).max(20),
    dataCoverage: dataCoverageSchema,
    payroll: payrollSchema.optional(),
    cashByPurpose: cashByPurposeSchema.optional(),
    scenario: scenarioSchema.optional(),
    movements: z.array(movementSchema).max(12).optional(),
    question: questionSchema.optional(),
    dataQuality: dataQualitySchema.optional(),
  })
  .strict();

export type AiPayload = z.infer<typeof aiPayloadSchema>;

/**
 * Field names that must never appear anywhere in a serialised payload, at any depth.
 *
 * `.strict()` already rejects unknown keys, so this is a second, independent check
 * against the same mistake — the kind of belt-and-braces that is worth the
 * duplication when the failure mode is "customer PII reached a US processor".
 */
export const PROHIBITED_KEY_PATTERNS: readonly RegExp[] = [
  /name$/i,
  /^name/i,
  /description/i,
  /narrative/i,
  /counterparty$/i,
  /\bemail\b/i,
  /phone/i,
  /address/i,
  /account(number|no|_no)/i,
  /iban/i,
  /\bcompanyid\b/i,
  /\buserid\b/i,
  /\brows?\b/i,
  /csv/i,
  /documenttext/i,
  /pdftext/i,
  /rowsnapshot/i,
  /passwordhash/i,
  /lastusermessage/i,
];

/** Exempt keys that would otherwise trip the patterns above but are known-safe. */
const PROHIBITED_KEY_EXEMPTIONS = new Set(['counterpartyCode', 'obligationCode']);

export function findProhibitedKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findProhibitedKeys(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const here =
        !PROHIBITED_KEY_EXEMPTIONS.has(key) && PROHIBITED_KEY_PATTERNS.some((re) => re.test(key))
          ? [`${path}.${key}`]
          : [];
      return [...here, ...findProhibitedKeys(child, `${path}.${key}`)];
    });
  }
  return [];
}
