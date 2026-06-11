import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiDataService } from './ai-data.service';
import {
  AI_CFO_SYSTEM_PROMPT,
  TreasuryAiContext,
  formatPayrollOutlook,
  formatTransactionAnswer,
  isPayrollQuestion,
  extractHorizonMonths,
  pruneMessageHistory,
} from './ai-context';
import type { AiChatDto } from '../dto/ai.dto';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface AiInsightResponse {
  insight: string;
  context: TreasuryAiContext;
  model: string;
  source: 'openai' | 'rule_based';
}

export interface AiChatResponse {
  reply: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: TreasuryAiContext;
  model: string;
  source: 'openai' | 'rule_based';
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiData: AiDataService,
  ) {}

  async chat(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    input: AiChatDto,
  ): Promise<AiChatResponse> {
    const start = Date.now();
    const history = pruneMessageHistory<ChatMessage>(input.messages);
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const context = await this.aiData.buildContext(companyId, lastUser?.content);

    const apiKey = process.env.OPENAI_API_KEY;
    let reply: string;
    let source: AiInsightResponse['source'];
    let model: string;

    if (apiKey) {
      try {
        const result = await this.callOpenAiChat(apiKey, context, history);
        reply = result.text;
        model = result.model;
        source = 'openai';
      } catch {
        reply = this.ruleBasedChatReply(context, history);
        model = 'rule-based-fallback';
        source = 'rule_based';
      }
    } else {
      reply = this.ruleBasedChatReply(context, history);
      model = 'rule-based-fallback';
      source = 'rule_based';
    }

    const messages = pruneMessageHistory<ChatMessage>([
      ...history,
      { role: 'assistant' as const, content: reply },
    ]);

    await this.audit(companyId, model, Date.now() - start);
    await this.prisma.aiInsight.create({
      data: {
        companyId,
        insightType: 'chat',
        content: reply,
        context: { ...context, lastUserMessage: lastUser?.content } as unknown as object,
      },
    });

    return { reply, messages, context, model, source };
  }

  async generateInsight(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    userQuestion?: string,
  ): Promise<AiInsightResponse> {
    const start = Date.now();
    const context = await this.aiData.buildContext(companyId, userQuestion);

    const apiKey = process.env.OPENAI_API_KEY;
    let insight: string;
    let source: AiInsightResponse['source'];
    let model: string;

    if (apiKey) {
      try {
        const result = await this.callOpenAi(apiKey, context, userQuestion);
        insight = result.text;
        model = result.model;
        source = 'openai';
      } catch {
        insight = userQuestion
          ? this.ruleBasedChatReply(context, [{ role: 'user', content: userQuestion }])
          : this.ruleBasedInsight(context);
        model = 'rule-based-fallback';
        source = 'rule_based';
      }
    } else {
      insight = userQuestion
        ? this.ruleBasedChatReply(context, [{ role: 'user', content: userQuestion }])
        : this.ruleBasedInsight(context);
      model = 'rule-based-fallback';
      source = 'rule_based';
    }

    await this.audit(companyId, model, Date.now() - start);
    await this.prisma.aiInsight.create({
      data: {
        companyId,
        insightType: userQuestion ? 'qa' : 'dashboard.summary',
        content: insight,
        context: context as unknown as object,
      },
    });

    return { insight, context, model, source };
  }

  private buildContextMessage(context: TreasuryAiContext): string {
    return `Treasury context (JSON) — analyse across bankTransactions, receivablesDetail, payablesDetail, budgetLines, forecastWeeks, and queryAnalysis:\n${JSON.stringify(context, null, 2)}`;
  }

  private async callOpenAiChat(
    apiKey: string,
    context: TreasuryAiContext,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<{ text: string; model: string }> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: AI_CFO_SYSTEM_PROMPT },
          { role: 'user', content: this.buildContextMessage(context) },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty AI response');
    return { text, model };
  }

  private ruleBasedChatReply(
    c: TreasuryAiContext,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): string {
    const last = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
    const q = last.toLowerCase();
    const analysis = c.queryAnalysis;

    if (isPayrollQuestion(q) || analysis?.intent === 'payroll') {
      const months = analysis?.horizonMonths ?? extractHorizonMonths(q);
      return formatPayrollOutlook(c, months);
    }

    if (analysis?.relevantTransactions.length) {
      const header =
        analysis.intent === 'transaction_lookup'
          ? 'Based on your bank transaction data:'
          : 'Here are the closest matches in your workspace:';
      return `${header}\n\n${formatTransactionAnswer(c.currency, analysis.relevantTransactions)}`;
    }

    if (
      q.includes('outflow') ||
      q.includes('payment') ||
      q.includes('spent') ||
      q.includes('expense') ||
      q.includes('debit')
    ) {
      const outflows = c.recentOutflows.slice(0, 8);
      if (outflows.length === 0) {
        return 'No cash outflows are recorded yet. Upload bank transactions in Upload Centre or add movements in Bank Accounts.';
      }
      return `**Recent cash outflows**\n\n${formatTransactionAnswer(c.currency, outflows)}`;
    }

    if (q.includes('inflow') || q.includes('receipt') || q.includes('received')) {
      const inflows = c.recentInflows.slice(0, 8);
      if (inflows.length === 0) {
        return 'No cash inflows are recorded yet. Upload bank transactions to populate this view.';
      }
      return `**Recent cash inflows**\n\n${formatTransactionAnswer(c.currency, inflows)}`;
    }

    if (q.includes('supplier') || q.includes('payable') || q.includes('vendor') || q.includes('bill')) {
      const items = analysis?.relevantPayables.length
        ? analysis.relevantPayables
        : c.payablesDetail.slice(0, 8);
      if (items.length === 0) {
        return 'No payables are loaded. Upload AP ageing in Upload Centre.';
      }
      const lines = items.map(
        (p) =>
          `- **${p.counterparty}** · ${c.currency} ${Math.round(p.amount).toLocaleString()} · due ${p.dueDate}${p.daysOverdue > 0 ? ` (${p.daysOverdue}d overdue)` : ''}`,
      );
      return `**Payables**\n\n${lines.join('\n')}`;
    }

    if (q.includes('runway')) {
      const runway =
        c.runwayWeeks === null ? 'not measurable (no net burn)' : `${c.runwayWeeks} weeks`;
      return `**Cash runway:** ${runway}\n\n- Current cash: ${c.currency} ${Math.round(c.currentCash).toLocaleString()}\n- Weekly burn: ${c.currency} ${Math.round(c.weeklyBurn).toLocaleString()}\n- Liquidity: ${c.liquidityStatus}`;
    }

    if (q.includes('overdue') || q.includes('receivable') || q.includes('customer')) {
      const items = analysis?.relevantReceivables.length
        ? analysis.relevantReceivables
        : c.receivablesDetail.filter((r) => r.daysOverdue > 0).slice(0, 8);
      if (items.length > 0) {
        const lines = items.map(
          (r) =>
            `- **${r.counterparty}** · ${c.currency} ${Math.round(r.amount).toLocaleString()} · due ${r.dueDate}${r.daysOverdue > 0 ? ` (${r.daysOverdue}d overdue)` : ''}`,
        );
        return `**Receivables**\n\n${lines.join('\n')}`;
      }
      return `**AR summary**\n\n- Overdue receivables: ${c.currency} ${Math.round(c.overdueReceivables).toLocaleString()}\n- Due within 30 days: ${c.arDue30Days === null ? 'n/a' : `${c.currency} ${Math.round(c.arDue30Days).toLocaleString()}`}\n- Delayed 90+ days: ${c.arDelayed90Days === null ? 'n/a' : `${c.currency} ${Math.round(c.arDelayed90Days).toLocaleString()}`}`;
    }

    if (q.includes('budget') || q.includes('actual') || q.includes('variance')) {
      const v = c.budgetMtdVariance ?? 0;
      const lines = c.budgetLines.slice(0, 6).map(
        (l) =>
          `- **${l.period} · ${l.category}** · budget ${c.currency} ${Math.round(l.budgetAmount).toLocaleString()} · actual ${c.currency} ${Math.round(l.actualAmount).toLocaleString()} · variance ${c.currency} ${Math.round(l.varianceAmount).toLocaleString()}`,
      );
      return `**Budget vs actual**\n\n- MTD variance: ${c.currency} ${Math.round(v).toLocaleString()} (${c.budgetVariancePct ?? 0}%)\n\n${lines.length ? 'Top lines:\n' + lines.join('\n') : 'No budget lines loaded yet.'}`;
    }

    return this.ruleBasedInsight(c);
  }

  private async callOpenAi(
    apiKey: string,
    context: TreasuryAiContext,
    userQuestion?: string,
  ): Promise<{ text: string; model: string }> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const userContent = `[AI CFO Briefing Request]

${this.buildContextMessage(context)}

${
      userQuestion ??
      'Provide a concise executive cash-flow briefing with 2-3 recommended actions based strictly on the injected data points above.'
    }`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: AI_CFO_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI request failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty AI response');
    return { text, model };
  }

  /** Deterministic executive briefing used when no OpenAI key is configured. */
  ruleBasedInsight(c: TreasuryAiContext): string {
    const fmt = (n: number | null) =>
      n === null ? 'n/a' : `${c.currency} ${Math.round(n).toLocaleString()}`;
    const runway =
      c.runwayWeeks === null ? 'not measurable (no net burn)' : `${c.runwayWeeks.toFixed(1)} weeks`;

    const lines: string[] = [];
    lines.push(
      `${c.companyName} holds ${fmt(c.currentCash)} in cash as of ${c.asOfDate}. ` +
        `Projected week-13 closing cash is ${fmt(c.week13ClosingCash)}.`,
    );
    lines.push(
      `Cash runway is ${runway}; liquidity status is ${c.liquidityStatus.replace('_', ' ')}.`,
    );

    if (c.overdueReceivables > 0) {
      lines.push(
        `Overdue receivables total ${fmt(c.overdueReceivables)} — prioritising collections would improve near-term liquidity.`,
      );
    }
    if (c.upcomingPayables > 0) {
      lines.push(`Upcoming payables of ${fmt(c.upcomingPayables)} fall due in the next two weeks.`);
    }

    if (c.recentOutflows.length > 0) {
      const top = c.recentOutflows[0];
      lines.push(
        `Latest outflow: ${fmt(top.amount)} on ${top.date} — ${top.description} (${top.accountName}).`,
      );
    }

    const recs: string[] = [];
    if (c.liquidityStatus === 'critical' || c.liquidityStatus === 'high_risk') {
      recs.push('Accelerate receivable collections and defer non-essential supplier payments.');
    }
    if (c.overdueReceivables > 0) {
      recs.push('Follow up on overdue invoices this week.');
    }
    recs.push('Review the 13-week forecast weekly and run a downside scenario.');

    lines.push('Recommended actions:');
    recs.slice(0, 3).forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push(
      'Note: figures are based on uploaded data and rule-based assumptions, not guaranteed outcomes.',
    );

    return lines.join('\n');
  }

  private async audit(companyId: string, model: string, latencyMs: number) {
    await this.prisma.aiLog.create({
      data: { companyId, model, latencyMs },
    });
  }
}
