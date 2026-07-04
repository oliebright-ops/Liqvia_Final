import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiDataService } from './ai-data.service';
import {
  buildSystemPrompt,
  BUSINESS_PULSE_SYSTEM_PROMPT,
  DECISION_CENTRE_SYSTEM_PROMPT,
  WHY_CHANGED_SYSTEM_PROMPT,
  formatPayrollOutlook,
  TreasuryAiContext,
  extractHorizonMonths,
  isPayrollQuestion,
  pruneMessageHistory,
} from './ai-context';
import {
  intentFromQuickPromptKey,
  isAiReplyIntent,
  ruleBasedReplyByIntent,
} from './ai-replies';
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

export interface BusinessPulseBriefing {
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

/** Minimal shape needed from a scenario comparison — kept local so AiService doesn't
 * depend on the scenarios module's types (avoids a cross-module type coupling). */
export interface DecisionScenarioSummary {
  baseline: { week13ClosingCash: number | null; runwayWeeks: number | null };
  scenario: { week13ClosingCash: number | null; runwayWeeks: number | null };
  delta: { week13ClosingCash: number | null; runwayWeeks: number | null };
}

export interface DecisionCentreResult {
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

/** Minimal shape needed from a detected movement — kept local so AiService doesn't
 * depend on the why-changed module's types. */
export interface WhyChangedMovement {
  label: string;
  current: number;
  previous: number;
  delta: number;
  percentChange: number | null;
  currentPeriod: string;
  previousPeriod: string;
}

export interface WhyChangedResult {
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** Fires once per process so a misconfigured key doesn't spam identical error logs on every request. */
  private hasLoggedMissingKeyForRealCompany = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiData: AiDataService,
  ) {}

  /**
   * True once no key is configured, logged at error level (not warn) so it surfaces in
   * Render logs — every AI CFO response for every company otherwise silently falls back
   * to rule-based templates with no operator-visible signal that OPENAI_API_KEY (marked
   * `sync: false` in render.yaml) is unset, expired, or invalid.
   */
  private warnMissingApiKey(companyId: string): void {
    const isRealCompany = companyId !== DEFAULT_DEMO_COMPANY_ID;
    if (isRealCompany && !this.hasLoggedMissingKeyForRealCompany) {
      this.hasLoggedMissingKeyForRealCompany = true;
      this.logger.error(
        `OPENAI_API_KEY is not set — AI CFO is serving rule-based fallback replies to a real company (${companyId}). Set OPENAI_API_KEY in the Render dashboard.`,
      );
    } else {
      this.logger.error('OPENAI_API_KEY is not set — AI CFO is serving a rule-based fallback.');
    }
  }

  async chat(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    input: AiChatDto,
  ): Promise<AiChatResponse> {
    const start = Date.now();
    const history = pruneMessageHistory<ChatMessage>(input.messages);
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const explicitIntent = this.resolveExplicitIntent(input.intent);
    const context = await this.aiData.buildContext(
      companyId,
      lastUser?.content,
      explicitIntent,
    );

    const apiKey = process.env.OPENAI_API_KEY;
    let reply: string;
    let source: AiInsightResponse['source'];
    let model: string;

    if (apiKey) {
      try {
        const result = await this.callOpenAiChat(apiKey, context, history, input.locale);
        reply = result.text;
        model = result.model;
        source = 'openai';
      } catch (err) {
        this.logger.error(`OpenAI chat failed, using rule-based fallback: ${String(err)}`);
        reply = this.ruleBasedChatReply(context, history, explicitIntent);
        model = 'rule-based-fallback:api-error';
        source = 'rule_based';
      }
    } else {
      this.warnMissingApiKey(companyId);
      reply = this.ruleBasedChatReply(context, history, explicitIntent);
      model = 'rule-based-fallback:no-api-key';
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
    locale?: string,
    intent?: string,
  ): Promise<AiInsightResponse> {
    const start = Date.now();
    const explicitIntent = this.resolveExplicitIntent(intent);
    const context = await this.aiData.buildContext(companyId, userQuestion, explicitIntent);

    const apiKey = process.env.OPENAI_API_KEY;
    let insight: string;
    let source: AiInsightResponse['source'];
    let model: string;

    if (apiKey) {
      try {
        const result = await this.callOpenAi(apiKey, context, userQuestion, locale);
        insight = result.text;
        model = result.model;
        source = 'openai';
      } catch (err) {
        this.logger.error(`OpenAI insight failed, using rule-based fallback: ${String(err)}`);
        insight = userQuestion
          ? this.ruleBasedChatReply(
              context,
              [{ role: 'user', content: userQuestion }],
              explicitIntent,
            )
          : this.ruleBasedInsight(context);
        model = 'rule-based-fallback:api-error';
        source = 'rule_based';
      }
    } else {
      this.warnMissingApiKey(companyId);
      insight = userQuestion
        ? this.ruleBasedChatReply(
            context,
            [{ role: 'user', content: userQuestion }],
            explicitIntent,
          )
        : this.ruleBasedInsight(context);
      model = 'rule-based-fallback:no-api-key';
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

  /** Phase 1 "Business Pulse" — a ≤120-word, plain-English daily briefing, distinct
   * prompt/format from the conversational AI CFO above (see BUSINESS_PULSE_SYSTEM_PROMPT). */
  async generateBusinessPulseBriefing(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
  ): Promise<BusinessPulseBriefing> {
    const start = Date.now();
    const context = await this.aiData.buildContext(companyId);

    const apiKey = process.env.OPENAI_API_KEY;
    let text: string;
    let model: string;
    let source: BusinessPulseBriefing['source'];

    if (apiKey) {
      try {
        const result = await this.callOpenAiBusinessPulse(apiKey, context);
        text = result.text;
        model = result.model;
        source = 'openai';
      } catch (err) {
        this.logger.error(`Business Pulse briefing failed, using rule-based fallback: ${String(err)}`);
        text = this.ruleBasedBusinessPulse(context);
        model = 'rule-based-fallback:api-error';
        source = 'rule_based';
      }
    } else {
      this.warnMissingApiKey(companyId);
      text = this.ruleBasedBusinessPulse(context);
      model = 'rule-based-fallback:no-api-key';
      source = 'rule_based';
    }

    await this.audit(companyId, model, Date.now() - start);
    await this.prisma.aiInsight.create({
      data: { companyId, insightType: 'business_pulse', content: text, context: context as unknown as object },
    });

    return { text, model, source };
  }

  private async callOpenAiBusinessPulse(
    apiKey: string,
    context: TreasuryAiContext,
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
          { role: 'system', content: BUSINESS_PULSE_SYSTEM_PROMPT },
          { role: 'user', content: this.buildContextMessage(context) },
        ],
        temperature: 0.2,
        max_tokens: 220,
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

  /** Deterministic fallback matching the Business Pulse prompt's 4-part structure. */
  private ruleBasedBusinessPulse(c: TreasuryAiContext): string {
    const healthLine =
      c.liquidityStatus === 'healthy'
        ? 'The business looks healthy.'
        : c.liquidityStatus === 'moderate'
          ? 'Cash is stable but tightening.'
          : c.liquidityStatus === 'high_risk'
            ? 'Cash is under pressure.'
            : 'Cash position is critical.';

    const soonestObligation = [...c.recurringObligations].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    )[0];
    const overduePayables = c.payablesDetail.filter((p) => p.daysOverdue > 0);
    const overdueReceivables = c.receivablesDetail.filter((r) => r.daysOverdue > 0);

    const attentionParts: string[] = [];
    if (soonestObligation) {
      attentionParts.push(`${soonestObligation.name} due ${soonestObligation.dueDate}`);
    }
    if (overduePayables.length > 0) {
      attentionParts.push(`${overduePayables.length} overdue bill(s)`);
    }
    const attention = attentionParts.length > 0 ? attentionParts.join('; ') : 'nothing urgent today';

    const wait =
      overdueReceivables.length > 0
        ? `${overdueReceivables.length} overdue invoice(s) can be chased this week`
        : 'routine items can wait';

    const actions: string[] = [];
    if (soonestObligation) actions.push(`Confirm funds are set aside for ${soonestObligation.name}.`);
    if (overduePayables.length > 0) actions.push('Review overdue supplier bills.');
    if (overdueReceivables.length > 0) actions.push('Follow up on overdue invoices.');
    const actionsText = actions
      .slice(0, 3)
      .map((a, i) => `${i + 1}. ${a}`)
      .join(' ');

    return `${healthLine} Needs attention: ${attention}. Can wait: ${wait}. ${actionsText}`.trim();
  }

  /** Phase 2 "Decision Centre" — answers a specific "Can I...?" question using the
   * scenario comparison already computed by the existing scenario engine (or, for a
   * freeform custom question with no scenario, live context alone). */
  async generateDecision(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    question: string,
    scenario: DecisionScenarioSummary | null,
    locale?: string,
  ): Promise<DecisionCentreResult> {
    const start = Date.now();
    const context = await this.aiData.buildContext(companyId, question);

    const apiKey = process.env.OPENAI_API_KEY;
    let text: string;
    let model: string;
    let source: DecisionCentreResult['source'];

    if (apiKey) {
      try {
        const result = await this.callOpenAiDecision(apiKey, context, question, scenario, locale);
        text = result.text;
        model = result.model;
        source = 'openai';
      } catch (err) {
        this.logger.error(`Decision Centre failed, using rule-based fallback: ${String(err)}`);
        text = this.ruleBasedDecision(context, scenario);
        model = 'rule-based-fallback:api-error';
        source = 'rule_based';
      }
    } else {
      this.warnMissingApiKey(companyId);
      text = this.ruleBasedDecision(context, scenario);
      model = 'rule-based-fallback:no-api-key';
      source = 'rule_based';
    }

    await this.audit(companyId, model, Date.now() - start);
    await this.prisma.aiInsight.create({
      data: {
        companyId,
        insightType: 'decision_centre',
        content: text,
        context: { ...context, question, scenario } as unknown as object,
      },
    });

    return { text, model, source };
  }

  private async callOpenAiDecision(
    apiKey: string,
    context: TreasuryAiContext,
    question: string,
    scenario: DecisionScenarioSummary | null,
    locale?: string,
  ): Promise<{ text: string; model: string }> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const scenarioLine = scenario
      ? `\n\nScenario comparison (JSON):\n${JSON.stringify(scenario, null, 2)}`
      : '\n\nNo scenario was modeled for this question — answer using current data only.';
    const userContent = `Business question: ${question}\n\n${this.buildContextMessage(context, locale)}${scenarioLine}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: DECISION_CENTRE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 400,
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

  /** Deterministic fallback matching the Decision Centre prompt's 5-section structure. */
  private ruleBasedDecision(context: TreasuryAiContext, scenario: DecisionScenarioSummary | null): string {
    const fmt = (n: number | null) =>
      n === null ? 'unknown' : `${context.currency} ${Math.round(n).toLocaleString('en-US')}`;

    if (!scenario) {
      return [
        '**Recommendation:** Unable to model this without a specific amount or percentage.',
        '**Confidence:** Low (rule-based fallback, no AI configured).',
        '**Reasoning:** This question needs a defined number to run against your forecast.',
        '**Key Risks:** N/A',
        '**Suggested Alternatives:** Try one of the preset buttons (Hire, Buy Equipment, Withdraw Funds, Repay Debt, Expand) with a specific number.',
      ].join('\n');
    }

    const { baseline, scenario: scenarioResult, delta } = scenario;
    const wouldGoNegative = scenarioResult.week13ClosingCash !== null && scenarioResult.week13ClosingCash < 0;
    const runwayDropsSharply = delta.runwayWeeks !== null && delta.runwayWeeks < -4;
    const recommendation = wouldGoNegative
      ? 'Proceed with caution — this pushes projected cash negative.'
      : runwayDropsSharply
        ? 'Proceed with caution — this meaningfully shortens your cash runway.'
        : 'This looks affordable based on your current forecast.';

    return [
      `**Recommendation:** ${recommendation}`,
      '**Confidence:** Rule-based estimate (no AI configured) — treat as directional only.',
      `**Reasoning:** Week-13 closing cash moves from ${fmt(baseline.week13ClosingCash)} to ${fmt(scenarioResult.week13ClosingCash)}; runway moves from ${baseline.runwayWeeks?.toFixed(1) ?? 'unknown'} to ${scenarioResult.runwayWeeks?.toFixed(1) ?? 'unknown'} weeks.`,
      '**Key Risks:** Timing and priority assumptions may not match reality — verify against actual figures.',
      '**Suggested Alternatives:** Consider phasing this in gradually or timing it for a stronger cash week.',
    ].join('\n');
  }

  /** Phase 4 "Why has this changed?" — narrates movements already detected and
   * materiality-filtered elsewhere (see movement-detection.ts); this call does not
   * decide what's material, only explains it in plain English. */
  async generateWhyChanged(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    movements: WhyChangedMovement[],
    locale?: string,
  ): Promise<WhyChangedResult> {
    const start = Date.now();

    if (movements.length === 0) {
      const text = 'Nothing material has changed since the last comparison period.';
      await this.audit(companyId, 'rule-based-no-movements', Date.now() - start);
      return { text, model: 'rule-based-no-movements', source: 'rule_based' };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    let text: string;
    let model: string;
    let source: WhyChangedResult['source'];

    if (apiKey) {
      try {
        const result = await this.callOpenAiWhyChanged(apiKey, movements, locale);
        text = result.text;
        model = result.model;
        source = 'openai';
      } catch (err) {
        this.logger.error(`Why Changed failed, using rule-based fallback: ${String(err)}`);
        text = this.ruleBasedWhyChanged(movements);
        model = 'rule-based-fallback:api-error';
        source = 'rule_based';
      }
    } else {
      this.warnMissingApiKey(companyId);
      text = this.ruleBasedWhyChanged(movements);
      model = 'rule-based-fallback:no-api-key';
      source = 'rule_based';
    }

    await this.audit(companyId, model, Date.now() - start);
    await this.prisma.aiInsight.create({
      data: { companyId, insightType: 'why_changed', content: text, context: { movements } as unknown as object },
    });

    return { text, model, source };
  }

  private async callOpenAiWhyChanged(
    apiKey: string,
    movements: WhyChangedMovement[],
    locale?: string,
  ): Promise<{ text: string; model: string }> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const localeLine = locale
      ? `\nRespond in ${locale === 'ru' ? 'Russian' : locale === 'es' ? 'Spanish' : locale === 'fr' ? 'French' : 'English'}.`
      : '';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: WHY_CHANGED_SYSTEM_PROMPT + localeLine },
          { role: 'user', content: `Material movements (JSON):\n${JSON.stringify(movements, null, 2)}` },
        ],
        temperature: 0.2,
        max_tokens: 320,
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

  /** Deterministic fallback — one bullet per movement, citing the same numbers the
   * AI prompt would have used. */
  private ruleBasedWhyChanged(movements: WhyChangedMovement[]): string {
    return movements
      .slice(0, 6)
      .map((m) => {
        const direction = m.delta >= 0 ? 'up' : 'down';
        const pct =
          m.percentChange !== null
            ? ` (${m.percentChange >= 0 ? '+' : ''}${m.percentChange.toFixed(0)}%)`
            : '';
        return `- **${m.label}** is ${direction} from ${Math.round(m.previous).toLocaleString()} to ${Math.round(m.current).toLocaleString()}${pct}.`;
      })
      .join('\n');
  }

  private resolveExplicitIntent(intent?: string): string | undefined {
    if (!intent) return undefined;
    const mapped = intentFromQuickPromptKey(intent);
    if (mapped) return mapped;
    return isAiReplyIntent(intent) ? intent : undefined;
  }

  private buildContextMessage(context: TreasuryAiContext, locale?: string): string {
    return `Treasury context (JSON) for ${context.companyName} — cite only these figures. Locale: ${locale ?? 'en'}.\n${JSON.stringify(context, null, 2)}`;
  }

  private async callOpenAiChat(
    apiKey: string,
    context: TreasuryAiContext,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    locale?: string,
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
          { role: 'system', content: buildSystemPrompt(locale) },
          { role: 'user', content: this.buildContextMessage(context, locale) },
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
    explicitIntent?: string,
  ): string {
    const last = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
    const analysis = c.queryAnalysis;

    if (isPayrollQuestion(last) || analysis?.intent === 'payroll') {
      const months = analysis?.horizonMonths ?? extractHorizonMonths(last);
      return formatPayrollOutlook(c, months);
    }

    const intent =
      (explicitIntent && isAiReplyIntent(explicitIntent) ? explicitIntent : undefined) ??
      analysis?.intent ??
      'general';

    return ruleBasedReplyByIntent(c, intent, analysis);
  }

  private async callOpenAi(
    apiKey: string,
    context: TreasuryAiContext,
    userQuestion?: string,
    locale?: string,
  ): Promise<{ text: string; model: string }> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const userContent = `[AI CFO Briefing Request]

${this.buildContextMessage(context, locale)}

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
          { role: 'system', content: buildSystemPrompt(locale) },
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
    return ruleBasedReplyByIntent(c, 'cash_position', c.queryAnalysis);
  }

  private async audit(companyId: string, model: string, latencyMs: number) {
    await this.prisma.aiLog.create({
      data: { companyId, model, latencyMs },
    });
  }
}
