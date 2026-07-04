import { DashboardPayload } from '../dashboard/dashboard.service';

export interface TreasuryAiTransaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  direction: 'IN' | 'OUT';
  accountName: string;
}

export interface TreasuryAiContext {
  companyName: string;
  currency: string;
  asOfDate: string;
  industry?: string | null;
  currentCash: number;
  aggregateAccountCount: number;
  week13ClosingCash: number | null;
  runwayWeeks: number | null;
  weeklyBurn: number;
  liquidityStatus: string;
  budgetMtdVariance: number | null;
  budgetVariancePct: number | null;
  overdueReceivables: number;
  upcomingPayables: number;
  arDue30Days: number | null;
  arDelayed90Days: number | null;
  apOverdue: number;
  freeAvailableCash?: number;
  fixedOutflowsHorizon?: number;
  horizonWeeks?: number;
  topBudgetVariances: Array<{ category: string; variancePercent: number | null }>;
  recentTransactions: Array<{
    date: string;
    description: string;
    category: string;
    amount: number;
    direction: string;
  }>;
  alerts: Array<{ type: string; severity: string; message: string }>;
  bankAccounts: Array<{ name: string; currency: string; balance: number }>;
  cashTransactions: TreasuryAiTransaction[];
  recentOutflows: TreasuryAiTransaction[];
  recentInflows: TreasuryAiTransaction[];
  receivablesDetail: Array<{
    counterparty: string;
    amount: number;
    invoiceDate: string;
    dueDate: string;
    daysOverdue: number;
    status: string;
  }>;
  payablesDetail: Array<{
    counterparty: string;
    amount: number;
    billDate: string;
    dueDate: string;
    daysOverdue: number;
    status: string;
    supplierPriority?: string;
  }>;
  budgetLines: Array<{
    period: string;
    category: string;
    budgetAmount: number;
    actualAmount: number;
    varianceAmount: number;
    variancePercent: number | null;
  }>;
  forecastWeeks: Array<{
    weekStart: string;
    weekIndex: number;
    openingCash: number;
    inflows: number;
    outflows: number;
    closingCash: number;
  }>;
  weeklyActuals: Array<{ period: string; category: string; amount: number }>;
  dataModules: {
    bankTransactions: number;
    receivables: number;
    payables: number;
    budgetLines: number;
    forecastWeeks: number;
  };
  recurringObligations: Array<{
    name: string;
    category: string;
    amount: number;
    frequency: string;
    dueDate: string;
  }>;
  dataQuality?: {
    score: number;
    warnings: string[];
  };
  queryAnalysis?: QueryAnalysis;
}

export interface QueryAnalysis {
  intent:
    | 'transaction_lookup'
    | 'outflow_summary'
    | 'inflow_summary'
    | 'payables'
    | 'receivables'
    | 'budget'
    | 'runway'
    | 'payroll'
    | 'cash_position'
    | 'risks'
    | 'expenses'
    | 'payment_advisory'
    | 'general';
  horizonMonths?: number;
  relevantTransactions: TreasuryAiTransaction[];
  relevantPayables: TreasuryAiContext['payablesDetail'];
  relevantReceivables: TreasuryAiContext['receivablesDetail'];
  matchedTerms: string[];
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'what',
  'which',
  'who',
  'when',
  'where',
  'why',
  'how',
  'for',
  'of',
  'to',
  'in',
  'on',
  'at',
  'my',
  'our',
  'this',
  'that',
  'it',
  'do',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
  'about',
  'specific',
  'cash',
  'flow',
  'money',
  'amount',
  'transaction',
  'payment',
  'please',
  'tell',
  'me',
  'show',
]);

export function buildTreasuryContext(dashboard: DashboardPayload): TreasuryAiContext {
  return {
    companyName: dashboard.companyName,
    currency: dashboard.currency,
    asOfDate: dashboard.asOfDate,
    currentCash: dashboard.cash.total,
    aggregateAccountCount: dashboard.cash.accountCount,
    week13ClosingCash: dashboard.liquidity.forecastClosing,
    runwayWeeks: dashboard.liquidity.runwayWeeks,
    weeklyBurn: dashboard.liquidity.weeklyBurn,
    liquidityStatus: dashboard.liquidity.liquidityStatus,
    budgetMtdVariance: dashboard.budget.mtdVariance,
    budgetVariancePct: dashboard.budget.variancePct,
    overdueReceivables: dashboard.kpis.overdueReceivables,
    upcomingPayables: dashboard.kpis.upcomingPayables,
    arDue30Days: dashboard.risk.arDue30,
    arDelayed90Days: dashboard.risk.arDelayed90,
    apOverdue: dashboard.risk.apOverdue,
    freeAvailableCash: dashboard.liquidity.freeAvailableCash,
    fixedOutflowsHorizon: dashboard.liquidity.fixedOutflowsHorizon,
    horizonWeeks: dashboard.liquidity.horizonWeeks,
    topBudgetVariances: dashboard.budgetVsActual.lines
      .slice()
      .sort((a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount))
      .slice(0, 5)
      .map((l) => ({ category: l.category, variancePercent: l.variancePercent })),
    recentTransactions: dashboard.recentTransactions.slice(0, 10).map((t) => ({
      date: t.transactionDate,
      description: t.description,
      category: t.category,
      amount: t.amount,
      direction: t.direction,
    })),
    alerts: dashboard.alerts.map((a) => ({
      type: a.alertType,
      severity: a.severity,
      message: a.message,
    })),
    bankAccounts: [],
    cashTransactions: [],
    recentOutflows: [],
    recentInflows: [],
    receivablesDetail: [],
    payablesDetail: [],
    budgetLines: [],
    forecastWeeks: [],
    weeklyActuals: [],
    recurringObligations: [],
    dataModules: {
      bankTransactions: dashboard.recentTransactions.length,
      receivables: 0,
      payables: 0,
      budgetLines: dashboard.budgetVsActual.lines.length,
      forecastWeeks: dashboard.forecast.length,
    },
  };
}

export function isPayrollQuestion(q: string): boolean {
  return /salary|salaries|payroll|wage|wages|compensation|зарплат|заработн/i.test(q);
}

export function extractHorizonMonths(q: string): number {
  const explicit = q.match(/(?:next|over|in)\s+(\d+)\s*months?/i);
  if (explicit) return Math.max(1, parseInt(explicit[1], 10));
  if (/next month/i.test(q)) return 1;
  if (/this quarter|next quarter/i.test(q)) return 3;
  if (/next year/i.test(q)) return 12;
  if (/next\s+two\s+months|2\s+months/i.test(q)) return 2;
  return 2;
}

export function analyzeUserQuery(
  question: string,
  context: TreasuryAiContext,
  explicitIntent?: string,
): QueryAnalysis {
  const q = question.toLowerCase();
  const matchedTerms = extractSearchTerms(question);
  const amounts = extractAmounts(q);
  const horizonMonths = extractHorizonMonths(q);

  const relevantPayables = scoreCounterparties(context.payablesDetail, matchedTerms, amounts).slice(
    0,
    6,
  );

  const relevantReceivables = scoreCounterparties(
    context.receivablesDetail,
    matchedTerms,
    amounts,
  ).slice(0, 6);

  let intent: QueryAnalysis['intent'] = 'general';
  if (explicitIntent === 'cash_position') intent = 'cash_position';
  else if (explicitIntent === 'risks') intent = 'risks';
  else if (explicitIntent === 'expenses') intent = 'expenses';
  else if (explicitIntent === 'runway') intent = 'runway';
  else if (explicitIntent === 'receivables') intent = 'receivables';
  else if (explicitIntent === 'payables') intent = 'payables';
  else if (explicitIntent === 'budget') intent = 'budget';
  else if (explicitIntent === 'payroll') intent = 'payroll';
  else if (isPayrollQuestion(q)) intent = 'payroll';
  // Checked before the generic payables/cash-position matchers: a question like
  // "Should I delay paying Apex Steel Framing this month, and what would happen to
  // my cash position?" names a specific supplier but doesn't contain the word
  // "payable"/"supplier"/"bill", while it DOES contain "cash position" — which
  // previously made it match isCashPositionQuestion and get a generic cash summary
  // that silently ignored the named supplier and the delay question. See F13.
  else if (isPaymentDelayAdvisoryQuestion(q)) intent = 'payment_advisory';
  else if (isPayablesQuestion(q)) intent = 'payables';
  else if (isReceivablesQuestion(q)) intent = 'receivables';
  else if (isRunwayQuestion(q)) intent = 'runway';
  else if (isCashPositionQuestion(q)) intent = 'cash_position';
  else if (isRisksQuestion(q)) intent = 'risks';
  else if (isExpensesQuestion(q)) intent = 'expenses';
  else if (isBudgetQuestion(q)) intent = 'budget';
  else if (isTransactionQuestion(q, amounts.length > 0)) intent = 'transaction_lookup';
  else if (isOutflowQuestion(q)) intent = 'outflow_summary';
  else if (isInflowQuestion(q)) intent = 'inflow_summary';

  const pool =
    intent === 'outflow_summary'
      ? context.recentOutflows
      : intent === 'inflow_summary'
        ? context.recentInflows
        : context.cashTransactions;

  const relevantTransactions = scoreTransactions(pool, matchedTerms, amounts, q).slice(0, 8);

  return {
    intent,
    horizonMonths,
    relevantTransactions,
    relevantPayables,
    relevantReceivables,
    matchedTerms,
  };
}

/**
 * Strong signals always mean a transaction lookup. The weak signals ("what is",
 * "what was", "why did", "explain", "for?") are far too generic on their own — any
 * question phrased as "what is driving the shortfall?" would match "what is" and
 * get hijacked into a transaction-lookup reply, even though it has nothing to do
 * with a specific transaction (see F14). They only count when the question also
 * carries a concrete dollar amount to search by, e.g. "what was that $5,000 charge
 * for?" — a genuine transaction lookup needs something specific to look up.
 */
function isTransactionQuestion(q: string, hasAmount: boolean): boolean {
  if (isPayrollQuestion(q) || isPayablesQuestion(q) || isReceivablesQuestion(q)) return false;
  const strongSignal =
    q.includes('outflow') ||
    q.includes('inflow') ||
    q.includes('transaction') ||
    q.includes('transfer');
  if (strongSignal) return true;
  const weakSignal =
    q.includes('what is') ||
    q.includes('what was') ||
    q.includes('why did') ||
    q.includes('explain') ||
    q.includes('for?');
  return weakSignal && hasAmount;
}

function isPayablesQuestion(q: string): boolean {
  return /payable|supplier|vendor|bill|поставщ|кредитор|оплат.*постав|счет.*постав|fournisseur|proveedor/.test(
    q,
  );
}

function isReceivablesQuestion(q: string): boolean {
  return /receivable|invoice|customer|overdue|дебитор|просроч.*дебитор|клиент.*долг|cr en retard|cobro/.test(
    q,
  );
}

/**
 * A named supplier delay question ("Should I delay paying Apex Steel Framing this
 * month?") rarely uses the words "payable"/"supplier"/"bill" — the counterparty
 * name is the only identifying detail. Matched ahead of isPayablesQuestion's
 * generic vocabulary check so it isn't required to guess the intent from wording. See F13.
 */
function isPaymentDelayAdvisoryQuestion(q: string): boolean {
  return /should i.*(delay|postpone|hold off|push back|defer|wait to pay)|delay (paying|payment)|postpone (paying|payment)|hold off (on )?paying|push back (the |a )?payment/.test(
    q,
  );
}

function isRunwayQuestion(q: string): boolean {
  return /runway|burn|run out of (cash|money)|running out of (cash|money)|out of cash|shortfall|deplete|запас.*ден|autonom|горизонт.*кас|autonomía|autonomie/.test(
    q,
  );
}

function isCashPositionQuestion(q: string): boolean {
  return /cash position|summarize.*cash|cash summary|позици.*кас|сводк.*кас|trésorerie|posición.*efectivo/.test(
    q,
  );
}

function isRisksQuestion(q: string): boolean {
  return /risk|risks|риск|financial risk|should i be aware|опасн|preocup|préoccup/.test(q);
}

function isExpensesQuestion(q: string): boolean {
  return /expense|expenses|top \d|spent|outflow|расход|затрат|gasto|dépense|debit/.test(q);
}

function isBudgetQuestion(q: string): boolean {
  return /budget|actual|variance|бюджет|отклон|presupuesto|écart/.test(q);
}

function isOutflowQuestion(q: string): boolean {
  return /outflow|spent|debit|расход|salida/.test(q) && !isPayablesQuestion(q);
}

function isInflowQuestion(q: string): boolean {
  return /inflow|receipt|received|credit|поступ|entrada|encaissement/.test(q);
}

function extractSearchTerms(q: string): string[] {
  return q
    .replace(/[^\p{L}\p{N}\s£$€.-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function extractAmounts(q: string): number[] {
  const amounts: number[] = [];
  const patterns = [
    /(?:£|\$|€|gbp|usd|eur)\s*([\d,]+(?:\.\d{1,2})?)\s*(k|m)?/gi,
    /\b([\d,]+(?:\.\d{1,2})?)\s*(k|m)\b/gi,
    /\b([\d,]+\.\d{2})\b/g,
    /\b([\d,]{4,})\b/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(q)) !== null) {
      const raw = match[1].replace(/,/g, '');
      let value = parseFloat(raw);
      if (!Number.isFinite(value)) continue;
      const suffix = (match[2] ?? '').toLowerCase();
      if (suffix === 'k') value *= 1000;
      if (suffix === 'm') value *= 1_000_000;
      amounts.push(value);
    }
  }
  return [...new Set(amounts)];
}

function scoreTransactions(
  transactions: TreasuryAiTransaction[],
  terms: string[],
  amounts: number[],
  q: string,
): TreasuryAiTransaction[] {
  const wantsOut = /outflow|out flow|payment|spent|debit|expense|paid/.test(q);
  const wantsIn = /inflow|receipt|received|credit|income/.test(q);

  return transactions
    .map((t) => {
      let score = 0;
      const desc = t.description.toLowerCase();
      for (const term of terms) {
        if (desc.includes(term)) score += 4;
        if (t.category.includes(term)) score += 2;
        if (t.accountName.toLowerCase().includes(term)) score += 1;
      }
      for (const amount of amounts) {
        if (amountsClose(t.amount, amount)) score += 12;
        if (amountsClose(t.amount, amount / 1000)) score += 8;
      }
      if (wantsOut && t.direction === 'OUT') score += 2;
      if (wantsIn && t.direction === 'IN') score += 2;
      return { t, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.t.date.localeCompare(a.t.date))
    .map((row) => row.t);
}

function scoreCounterparties<T extends { counterparty: string; amount: number }>(
  items: T[],
  terms: string[],
  amounts: number[],
): T[] {
  return items
    .map((item) => {
      let score = 0;
      const name = item.counterparty.toLowerCase();
      for (const term of terms) {
        if (name.includes(term)) score += 5;
      }
      for (const amount of amounts) {
        if (amountsClose(item.amount, amount)) score += 10;
      }
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, b * 0.02);
}

function addMonthsIso(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function isoWeekStart(period: string): string | null {
  const match = period.match(/^(\d{4})-W(\d{1,2})$/i);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return weekStart.toISOString().slice(0, 10);
}

function periodInHorizon(period: string, asOfDate: string, horizonEnd: string): boolean {
  const monthly = period.match(/^(\d{4})-(\d{2})$/);
  if (monthly && !period.includes('W') && !period.includes('Q')) {
    const periodEnd = `${monthly[1]}-${monthly[2]}-28`;
    return periodEnd >= asOfDate.slice(0, 7) && period.slice(0, 7) <= horizonEnd.slice(0, 7);
  }
  const weekStart = isoWeekStart(period);
  if (weekStart) {
    return weekStart >= asOfDate && weekStart <= horizonEnd;
  }
  return period >= asOfDate.slice(0, 7) && period <= horizonEnd.slice(0, 7);
}

function isPayrollPayable(p: TreasuryAiContext['payablesDetail'][number]): boolean {
  if (p.supplierPriority === 'payroll') return true;
  return /payroll|salary|wage|зарплат|заработн/i.test(p.counterparty);
}

function isPayrollTransaction(t: TreasuryAiTransaction): boolean {
  return t.category === 'payroll' || /payroll|salary|wage|зарплат|заработн/i.test(t.description);
}

export function formatPayrollOutlook(context: TreasuryAiContext, months: number): string {
  const fmt = (n: number) => `${context.currency} ${Math.round(n).toLocaleString('en-US')}`;
  const horizonEnd = addMonthsIso(context.asOfDate, months);
  const lines: string[] = [];

  lines.push(
    `**Expected salary / payroll outflows (next ${months} month${months === 1 ? '' : 's'})**`,
  );
  lines.push(`As of ${context.asOfDate} through ${horizonEnd}.`);

  const payrollPayables = context.payablesDetail.filter(
    (p) => isPayrollPayable(p) && p.dueDate >= context.asOfDate && p.dueDate <= horizonEnd,
  );
  const payablesTotal = payrollPayables.reduce((s, p) => s + p.amount, 0);

  const payrollBudget = context.budgetLines.filter(
    (l) => l.category === 'payroll' && periodInHorizon(l.period, context.asOfDate, horizonEnd),
  );
  const budgetTotal = payrollBudget.reduce((s, l) => s + Math.abs(l.budgetAmount), 0);

  const payrollActuals = context.weeklyActuals.filter((a) => a.category === 'payroll');
  const actualsTotal = payrollActuals
    .filter((a) => periodInHorizon(a.period, context.asOfDate, horizonEnd))
    .reduce((s, a) => s + Math.abs(a.amount), 0);

  const payrollTxns = context.cashTransactions.filter(isPayrollTransaction);
  const recentMonthlyAvg =
    payrollTxns.length > 0
      ? (payrollTxns.reduce((s, t) => s + t.amount, 0) / Math.max(1, payrollTxns.length)) *
        4 *
        months
      : 0;

  if (payrollPayables.length > 0) {
    lines.push(`\n**Scheduled payroll payables (AP): ${fmt(payablesTotal)}**`);
    for (const p of payrollPayables.slice(0, 8)) {
      lines.push(`- ${p.counterparty} · ${fmt(p.amount)} · due ${p.dueDate}`);
    }
    if (payrollPayables.length > 8) {
      lines.push(`- …and ${payrollPayables.length - 8} more`);
    }
  }

  if (payrollBudget.length > 0) {
    lines.push(`\n**Budgeted payroll in period: ${fmt(budgetTotal)}**`);
    for (const l of payrollBudget.slice(0, 6)) {
      lines.push(
        `- ${l.period} · budget ${fmt(Math.abs(l.budgetAmount))} · actual ${fmt(Math.abs(l.actualAmount))}`,
      );
    }
  }

  if (payrollActuals.length > 0 && actualsTotal > 0) {
    lines.push(`\n**Recorded payroll actuals in period: ${fmt(actualsTotal)}**`);
  }

  if (payrollTxns.length > 0) {
    lines.push(
      `\n**Recent payroll payments:** ${payrollTxns.length} transaction(s); rough run-rate ~${fmt(recentMonthlyAvg)} over ${months} month(s) if pattern continues.`,
    );
    lines.push(formatTransactionAnswer(context.currency, payrollTxns.slice(0, 5)));
  }

  const bestEstimate =
    payablesTotal > 0
      ? payablesTotal
      : budgetTotal > 0
        ? budgetTotal
        : actualsTotal > 0
          ? actualsTotal
          : recentMonthlyAvg;

  if (bestEstimate > 0) {
    lines.push(
      `\n**Best estimate:** about **${fmt(bestEstimate)}** based on ${payablesTotal > 0 ? 'scheduled payroll payables' : budgetTotal > 0 ? 'budget lines' : actualsTotal > 0 ? 'recorded actuals' : 'recent payment run-rate'}.`,
    );
  } else {
    lines.push(
      '\nI could not find payroll budget lines, payroll-tagged payables, or payroll bank transactions in your workspace for this horizon. Upload AP ageing with Supplier Priority = payroll, a budget with payroll category, or bank transactions with payroll descriptions.',
    );
  }

  return lines.join('\n');
}

export function formatTransactionAnswer(
  currency: string,
  transactions: TreasuryAiTransaction[],
): string {
  if (transactions.length === 0) {
    return 'I could not find a matching bank transaction in the uploaded data. Check Bank Accounts or upload bank transactions with clearer descriptions.';
  }
  const lines = transactions.map(
    (t) =>
      `- **${t.date}** · ${t.direction} · ${currency} ${Math.round(t.amount).toLocaleString()} · ${t.accountName}\n  ${t.description} (${t.category})`,
  );
  return `**Matching bank transactions**\n\n${lines.join('\n\n')}`;
}

export const AI_CFO_SYSTEM_PROMPT = `You are AI CFO — the executive treasury intelligence layer for Liqvia.

Your role: analyze ONLY the JSON treasury context injected with each request (bankTransactions, receivablesDetail, payablesDetail, budgetLines, forecastWeeks, weeklyActuals, recurringObligations, dataQuality, alerts, queryAnalysis).

Rules:
1. Never invent figures, counterparties, dates, or transaction purposes.
2. Every answer must cite at least two specific numbers from the context for the user's company (amounts, dates, counterparties, or counts).
3. If data is missing for the question, say so explicitly and name which upload is needed (AR ageing, AP ageing, bank transactions, weekly actuals).
4. One clear insight per response — focus on what is urgent for THIS company, not generic treasury advice.
5. Recommend one actionable next step tied to cited data (e.g. collect a named overdue invoice).
6. For transaction questions, search cashTransactions, recentOutflows, recentInflows, and queryAnalysis.relevantTransactions.
7. If queryAnalysis is present, use its intent and relevantTransactions / relevantPayables / relevantReceivables.
8. Use Markdown bullet lists. Tone: calm, precise, executive-friendly.
9. Respond in the user's locale language when locale is provided in the context payload.
10. recurringObligations are fixed/recurring commitments (payroll, super, PAYG, GST/BAS, rent, loan repayments, insurance, subscriptions) — distinct from payablesDetail, which is real uploaded AP bills. For payroll/rent/tax outlook questions, prefer recurringObligations when payablesDetail lacks a matching entry, and never sum the two together for the same obligation.
11. If dataQuality.score is below 70 or dataQuality.warnings is non-empty, briefly caveat that the answer's confidence is limited by the listed stale/missing data before giving the figure.`;

export function buildSystemPrompt(locale?: string): string {
  const localeLine = locale
    ? `\n10. Respond in ${locale === 'ru' ? 'Russian' : locale === 'es' ? 'Spanish' : locale === 'fr' ? 'French' : 'English'}.`
    : '';
  return AI_CFO_SYSTEM_PROMPT + localeLine;
}

/** Business Pulse: a 30-second, plain-English daily briefing — distinct from the
 * general AI CFO prompt above, which is conversational and can run much longer. */
export const BUSINESS_PULSE_SYSTEM_PROMPT = `You are the CFO of this business. The owner has only 30 seconds.

Analyze ONLY the JSON treasury context injected with this request (recurringObligations, payablesDetail, receivablesDetail, forecastWeeks, alerts, dataQuality). Never invent figures, counterparties, or dates not present in the data.

Answer, in this order:
1. Is the business healthy?
2. What needs attention today?
3. What can safely wait?
4. List no more than three actions.

Use plain English — avoid words like "treasury", "liquidity", or "runway". Maximum 120 words total.`;

/** Phase 2 "Decision Centre": answers a specific "Can I...?" business question with a
 * structured recommendation, grounded in the scenario comparison already computed by
 * the existing forecast/scenario engine — this prompt does not run its own forecast. */
export const DECISION_CENTRE_SYSTEM_PROMPT = `You are the company's CFO. Answer the business question first.

Analyze ONLY the JSON treasury context and scenario comparison injected with this request. Never invent figures.

Return exactly these five sections, each on its own line starting with the bold label:
**Recommendation:** one sentence.
**Confidence:** High, Medium, or Low, with a one-phrase reason.
**Reasoning:** 2-3 sentences citing specific numbers from the context (closing cash, runway, obligations).
**Key Risks:** 1-3 bullet points.
**Suggested Alternatives:** 1-2 bullet points.

Support every statement using the available cashflow, forecast, obligations, and confidence data. Plain English — avoid "treasury", "liquidity", "runway".`;

export const MAX_CHAT_MESSAGES = 10;

export function pruneMessageHistory<T>(messages: T[], max = MAX_CHAT_MESSAGES): T[] {
  return messages.slice(-max);
}
