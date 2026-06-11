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

export function analyzeUserQuery(question: string, context: TreasuryAiContext): QueryAnalysis {
  const q = question.toLowerCase();
  const matchedTerms = extractSearchTerms(q);
  const amounts = extractAmounts(q);
  const horizonMonths = extractHorizonMonths(q);

  let intent: QueryAnalysis['intent'] = 'general';
  if (isPayrollQuestion(q)) intent = 'payroll';
  else if (isTransactionQuestion(q)) intent = 'transaction_lookup';
  else if (
    q.includes('outflow') ||
    q.includes('spent') ||
    q.includes('expense') ||
    q.includes('debit')
  )
    intent = 'outflow_summary';
  else if (
    q.includes('inflow') ||
    q.includes('receipt') ||
    q.includes('received') ||
    q.includes('credit')
  )
    intent = 'inflow_summary';
  else if (
    q.includes('payable') ||
    q.includes('supplier') ||
    q.includes('vendor') ||
    q.includes('bill')
  )
    intent = 'payables';
  else if (
    q.includes('receivable') ||
    q.includes('invoice') ||
    q.includes('customer') ||
    q.includes('overdue')
  )
    intent = 'receivables';
  else if (q.includes('budget') || q.includes('actual') || q.includes('variance'))
    intent = 'budget';
  else if (q.includes('runway') || q.includes('burn')) intent = 'runway';

  const pool =
    intent === 'outflow_summary'
      ? context.recentOutflows
      : intent === 'inflow_summary'
        ? context.recentInflows
        : context.cashTransactions;

  const relevantTransactions = scoreTransactions(pool, matchedTerms, amounts, q).slice(0, 8);

  const relevantPayables = scoreCounterparties(context.payablesDetail, matchedTerms, amounts).slice(
    0,
    6,
  );

  const relevantReceivables = scoreCounterparties(
    context.receivablesDetail,
    matchedTerms,
    amounts,
  ).slice(0, 6);

  return {
    intent,
    horizonMonths,
    relevantTransactions,
    relevantPayables,
    relevantReceivables,
    matchedTerms,
  };
}

function isTransactionQuestion(q: string): boolean {
  if (isPayrollQuestion(q)) return false;
  return (
    q.includes('outflow') ||
    q.includes('inflow') ||
    q.includes('transaction') ||
    q.includes('payment') ||
    q.includes('transfer') ||
    q.includes('what is') ||
    q.includes('what was') ||
    q.includes('why did') ||
    q.includes('explain') ||
    q.includes('for?')
  );
}

function extractSearchTerms(q: string): string[] {
  return q
    .replace(/[^a-z0-9\s£$€.-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
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

Your role: answer treasury questions using ONLY the JSON context provided (bank transactions, receivables, payables, budget lines, forecast, alerts).

Rules:
- Never invent figures, counterparties, or transaction purposes.
- For questions about a specific payment, outflow, inflow, or transaction: search cashTransactions, recentOutflows, recentInflows, and queryAnalysis.relevantTransactions. Cite date, amount, account, and description.
- If queryAnalysis is present, prioritise its relevantTransactions, relevantPayables, and relevantReceivables.
- Cross-reference modules: a large outflow may relate to payablesDetail or budgetLines in the same period/category.
- If no matching row exists, say clearly that the data is not in the workspace and suggest uploading bank transactions or checking Bank Accounts.
- Use Markdown: bullet lists and short tables where helpful.
- Tone: calm, precise, executive-friendly.
- Acknowledge uncertainty where data is incomplete.`;

export const MAX_CHAT_MESSAGES = 10;

export function pruneMessageHistory<T>(messages: T[], max = MAX_CHAT_MESSAGES): T[] {
  return messages.slice(-max);
}
