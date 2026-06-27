import type { QueryAnalysis, TreasuryAiContext, TreasuryAiTransaction } from './ai-context';

export type AiReplyIntent =
  | QueryAnalysis['intent']
  | 'cash_position'
  | 'risks'
  | 'expenses';

const VALID_INTENTS = new Set<string>([
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
  'general',
]);

export function isAiReplyIntent(value: string | undefined): value is AiReplyIntent {
  return !!value && VALID_INTENTS.has(value);
}

/** Map frontend quick-prompt keys to backend intents. */
export function intentFromQuickPromptKey(key: string): AiReplyIntent | undefined {
  const map: Record<string, AiReplyIntent> = {
    runway: 'runway',
    expenses: 'expenses',
    overdueAr: 'receivables',
    suppliers: 'payables',
    cashPosition: 'cash_position',
    budget: 'budget',
    risks: 'risks',
  };
  return map[key];
}

export function hasTreasuryData(context: TreasuryAiContext): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (context.bankAccounts.length === 0 && context.currentCash === 0) {
    missing.push('bank balances');
  }
  if (context.receivablesDetail.length === 0) missing.push('AR ageing');
  if (context.payablesDetail.length === 0) missing.push('AP ageing');
  if (context.cashTransactions.length === 0) missing.push('bank transactions');
  if (context.weeklyActuals.length === 0) missing.push('weekly actuals');

  const ok =
    context.currentCash !== 0 ||
    context.bankAccounts.length > 0 ||
    context.receivablesDetail.length > 0 ||
    context.payablesDetail.length > 0 ||
    context.cashTransactions.length > 0 ||
    context.budgetLines.length > 0;

  return { ok, missing };
}

function requireModule(
  context: TreasuryAiContext,
  module: 'ar' | 'ap' | 'transactions' | 'budget',
): string | null {
  if (module === 'ar' && context.receivablesDetail.length === 0) {
    return `No AR ageing loaded for **${context.companyName}**. Upload customer invoices in Upload Center.`;
  }
  if (module === 'ap' && context.payablesDetail.length === 0) {
    return `No AP ageing loaded for **${context.companyName}**. Upload supplier bills in Upload Center.`;
  }
  if (module === 'transactions' && context.cashTransactions.length === 0) {
    return `No bank transactions loaded for **${context.companyName}**. Upload bank transactions in Upload Center.`;
  }
  if (module === 'budget' && context.budgetLines.length === 0) {
    return `No budget lines loaded for **${context.companyName}**. Upload budget or prior-period budget in Upload Center.`;
  }
  return null;
}

export function formatNoDataMessage(context: TreasuryAiContext, locale = 'en'): string {
  const { missing } = hasTreasuryData(context);
  if (locale === 'ru') {
    return `У **${context.companyName}** пока недостаточно данных для персонального ответа.\n\nЗагрузите в Upload Center:\n1. AR ageing (счета клиентов)\n2. AP ageing (счета поставщиков)\n3. Банковские транзакции или остатки\n\nНе хватает: ${missing.join(', ') || 'основных модулей'}.`;
  }
  return `I don't have enough uploaded data for **${context.companyName}** to answer precisely yet.\n\nUpload in Upload Center:\n1. AR ageing (customer invoices with due dates)\n2. AP ageing (supplier bills with due dates)\n3. Bank transactions or balances\n\nMissing: ${missing.join(', ') || 'core modules'}.`;
}

function fmt(currency: string, n: number | null): string {
  return n === null ? 'n/a' : `${currency} ${Math.round(n).toLocaleString('en-US')}`;
}

function formatTxnList(currency: string, transactions: TreasuryAiTransaction[]): string {
  if (transactions.length === 0) {
    return 'No matching bank transactions in your workspace.';
  }
  return transactions
    .map(
      (t) =>
        `- **${t.date}** · ${t.direction} · ${currency} ${Math.round(t.amount).toLocaleString('en-US')} · ${t.accountName}\n  ${t.description} (${t.category})`,
    )
    .join('\n\n');
}

export function formatRunwayReply(context: TreasuryAiContext): string {
  const runway =
    context.runwayWeeks === null
      ? 'not measurable (no net burn)'
      : `${context.runwayWeeks.toFixed(1)} weeks`;
  const lines = [
    `**Cash runway for ${context.companyName}** (as of ${context.asOfDate})`,
    '',
    `- Current cash: ${fmt(context.currency, context.currentCash)} across ${context.aggregateAccountCount} account(s)`,
    `- Weekly burn: ${fmt(context.currency, context.weeklyBurn)}`,
    `- Runway: **${runway}**`,
    `- Liquidity status: ${context.liquidityStatus.replace('_', ' ')}`,
    `- Week-13 closing cash (forecast): ${fmt(context.currency, context.week13ClosingCash)}`,
  ];
  if (context.freeAvailableCash !== undefined) {
    lines.push(
      `- Free cash after known outflows (${context.horizonWeeks ?? 13}w): ${fmt(context.currency, context.freeAvailableCash)}`,
    );
  }
  if (context.overdueReceivables > 0) {
    lines.push(
      `- Overdue receivables: ${fmt(context.currency, context.overdueReceivables)} — collections would extend runway if delayed AR slips.`,
    );
  }
  return lines.join('\n');
}

export function formatCashPositionReply(context: TreasuryAiContext): string {
  const accounts =
    context.bankAccounts.length > 0
      ? context.bankAccounts
          .map((a) => `  - ${a.name}: ${fmt(a.currency, a.balance)}`)
          .join('\n')
      : '  - (no bank accounts loaded)';
  return [
    `**Cash position — ${context.companyName}** (${context.asOfDate})`,
    '',
    `- Total cash: **${fmt(context.currency, context.currentCash)}**`,
    `- Accounts:\n${accounts}`,
    `- Week-13 forecast closing: ${fmt(context.currency, context.week13ClosingCash)}`,
    `- Runway: ${context.runwayWeeks === null ? 'n/a' : `${context.runwayWeeks.toFixed(1)} weeks`}`,
    context.freeAvailableCash !== undefined
      ? `- Free cash after known outflows: ${fmt(context.currency, context.freeAvailableCash)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatExpensesReply(context: TreasuryAiContext): string {
  const month = context.asOfDate.slice(0, 7);
  const monthOutflows = context.recentOutflows.filter((t) => t.date.startsWith(month));
  const pool = monthOutflows.length > 0 ? monthOutflows : context.recentOutflows;
  const top = pool.slice(0, 5);
  const total = pool.reduce((s, t) => s + t.amount, 0);

  if (top.length === 0) {
    return `No cash outflows recorded for **${context.companyName}** yet. Upload bank transactions in Upload Center.`;
  }

  const byCategory = new Map<string, number>();
  for (const t of pool) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  const categoryLines = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `- ${cat}: ${fmt(context.currency, amt)}`);

  return [
    `**Top outflows for ${context.companyName}** (${month === context.asOfDate.slice(0, 7) ? 'current month' : 'recent'})`,
    '',
    `- Total outflows in scope: ${fmt(context.currency, total)}`,
    '',
    '**By category:**',
    categoryLines.join('\n'),
    '',
    '**Largest transactions:**',
    formatTxnList(context.currency, top),
  ].join('\n');
}

export function formatPayablesReply(context: TreasuryAiContext, analysis?: QueryAnalysis): string {
  const asOf = new Date(`${context.asOfDate}T00:00:00.000Z`);
  const weekEnd = new Date(asOf);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const items = (analysis?.relevantPayables.length ? analysis.relevantPayables : context.payablesDetail)
    .filter((p) => {
      const due = new Date(`${p.dueDate}T00:00:00.000Z`);
      return due >= asOf && due <= weekEnd;
    })
    .slice(0, 10);

  const fallback = context.payablesDetail
    .filter((p) => p.dueDate >= context.asOfDate)
    .slice(0, 8);

  const list = items.length > 0 ? items : fallback;
  if (list.length === 0) {
    return `No payables loaded for **${context.companyName}**. Upload AP ageing in Upload Center.`;
  }

  const header =
    items.length > 0
      ? `**Suppliers requiring payment within 7 days** (${context.asOfDate})`
      : `**Upcoming payables for ${context.companyName}**`;

  const lines = list.map(
    (p) =>
      `- **${p.counterparty}** · ${fmt(context.currency, p.amount)} · due ${p.dueDate}${p.daysOverdue > 0 ? ` (${p.daysOverdue}d overdue)` : ''}${p.supplierPriority ? ` · ${p.supplierPriority}` : ''}`,
  );
  return `${header}\n\n${lines.join('\n')}\n\nTotal shown: ${fmt(context.currency, list.reduce((s, p) => s + p.amount, 0))}`;
}

export function formatReceivablesReply(context: TreasuryAiContext, analysis?: QueryAnalysis): string {
  const items = (
    analysis?.relevantReceivables.length
      ? analysis.relevantReceivables
      : context.receivablesDetail.filter((r) => r.daysOverdue > 0)
  ).slice(0, 10);

  if (items.length === 0 && context.receivablesDetail.length === 0) {
    return `No receivables loaded for **${context.companyName}**. Upload AR ageing in Upload Center.`;
  }

  if (items.length > 0) {
    const lines = items.map(
      (r) =>
        `- **${r.counterparty}** · ${fmt(context.currency, r.amount)} · due ${r.dueDate}${r.daysOverdue > 0 ? ` (**${r.daysOverdue}d overdue**)` : ''}`,
    );
    return `**Overdue / matched receivables — ${context.companyName}**\n\n${lines.join('\n')}\n\nTotal shown: ${fmt(context.currency, items.reduce((s, r) => s + r.amount, 0))}`;
  }

  return [
    `**AR summary — ${context.companyName}**`,
    `- Overdue receivables: ${fmt(context.currency, context.overdueReceivables)}`,
    `- Due within 30 days: ${fmt(context.currency, context.arDue30Days)}`,
    `- Delayed 90+ days: ${fmt(context.currency, context.arDelayed90Days)}`,
  ].join('\n');
}

export function formatBudgetReply(context: TreasuryAiContext): string {
  const lines = context.budgetLines.slice(0, 8).map(
    (l) =>
      `- **${l.period} · ${l.category}** · budget ${fmt(context.currency, l.budgetAmount)} · actual ${fmt(context.currency, l.actualAmount)} · variance ${fmt(context.currency, l.varianceAmount)}`,
  );
  return [
    `**Budget vs actual — ${context.companyName}**`,
    `- MTD variance: ${fmt(context.currency, context.budgetMtdVariance)} (${context.budgetVariancePct ?? 0}%)`,
    lines.length ? `\nTop lines:\n${lines.join('\n')}` : '\nNo budget lines loaded yet.',
  ].join('\n');
}

export function formatRisksReply(context: TreasuryAiContext): string {
  const risks: string[] = [];
  const fmtLocal = (n: number | null) => fmt(context.currency, n);

  if (context.overdueReceivables > 0 && context.receivablesDetail.length > 0) {
    const totalAr = context.receivablesDetail.reduce((s, r) => s + r.amount, 0);
    const pct = totalAr > 0 ? Math.round((context.overdueReceivables / totalAr) * 100) : 0;
    if (pct >= 30) {
      risks.push(
        `**Collection risk:** overdue AR is ${fmtLocal(context.overdueReceivables)} (${pct}% of open AR).`,
      );
    } else {
      risks.push(`**Overdue AR:** ${fmtLocal(context.overdueReceivables)} outstanding past due date.`);
    }
  }

  if (
    context.freeAvailableCash !== undefined &&
    context.freeAvailableCash < 0
  ) {
    risks.push(
      `**Liquidity stress:** free cash after known outflows is ${fmtLocal(context.freeAvailableCash)} over the ${context.horizonWeeks ?? 13}-week horizon.`,
    );
  } else if (
    context.runwayWeeks !== null &&
    context.runwayWeeks < 8
  ) {
    risks.push(`**Short runway:** ${context.runwayWeeks.toFixed(1)} weeks at current burn.`);
  }

  if (context.upcomingPayables > 0) {
    risks.push(`**Near-term payables:** ${fmtLocal(context.upcomingPayables)} due within two weeks.`);
  }

  if (context.apOverdue > 0) {
    risks.push(`**Overdue payables:** ${fmtLocal(context.apOverdue)} already past due.`);
  }

  for (const alert of context.alerts.slice(0, 3)) {
    risks.push(`**Alert (${alert.severity}):** ${alert.message}`);
  }

  if (risks.length === 0) {
    return `**Financial risks — ${context.companyName}**\n\nNo critical flags from uploaded data as of ${context.asOfDate}. Continue monitoring runway (${context.runwayWeeks ?? 'n/a'} weeks) and week-13 closing ${fmtLocal(context.week13ClosingCash)}.`;
  }

  const actions: string[] = [];
  if (context.overdueReceivables > 0) {
    const top = context.receivablesDetail
      .filter((r) => r.daysOverdue > 0)
      .sort((a, b) => b.amount - a.amount)[0];
    if (top) {
      actions.push(
        `Prioritise collecting ${fmtLocal(top.amount)} from **${top.counterparty}** (${top.daysOverdue}d overdue).`,
      );
    }
  }
  if (context.freeAvailableCash !== undefined && context.freeAvailableCash < 0) {
    actions.push('Review deferrable AP and run a receivable-delay scenario in Scenarios.');
  }

  return [
    `**Financial risks — ${context.companyName}** (${context.asOfDate})`,
    '',
    ...risks,
    actions.length ? `\n**Suggested next step:** ${actions[0]}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function ruleBasedReplyByIntent(
  context: TreasuryAiContext,
  intent: AiReplyIntent,
  analysis?: QueryAnalysis,
): string {
  const { ok } = hasTreasuryData(context);
  if (!ok) {
    return formatNoDataMessage(context);
  }

  switch (intent) {
    case 'runway':
    case 'cash_position':
      return intent === 'runway' ? formatRunwayReply(context) : formatCashPositionReply(context);
    case 'expenses':
    case 'outflow_summary': {
      const missing = requireModule(context, 'transactions');
      return missing ?? formatExpensesReply(context);
    }
    case 'payables': {
      const missing = requireModule(context, 'ap');
      return missing ?? formatPayablesReply(context, analysis);
    }
    case 'receivables': {
      const missing = requireModule(context, 'ar');
      return missing ?? formatReceivablesReply(context, analysis);
    }
    case 'budget': {
      const missing = requireModule(context, 'budget');
      return missing ?? formatBudgetReply(context);
    }
    case 'risks':
      return formatRisksReply(context);
    case 'payroll':
      return analysis ? formatPayablesReply(context, analysis) : formatRunwayReply(context);
    case 'inflow_summary': {
      const inflows = context.recentInflows.slice(0, 8);
      return `**Recent inflows — ${context.companyName}**\n\n${formatTxnList(context.currency, inflows)}`;
    }
    case 'transaction_lookup':
      if (analysis?.relevantTransactions.length) {
        return `**Matching bank transactions — ${context.companyName}**\n\n${formatTxnList(context.currency, analysis.relevantTransactions)}`;
      }
      return formatExpensesReply(context);
    case 'general':
    default:
      return formatCashPositionReply(context);
  }
}
