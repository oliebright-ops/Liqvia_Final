import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiDataService } from './ai-data.service';
import {
  AiPayloadRejectedError,
  AiPrivacyGatewayService,
  type AiPayload,
  type GatewayResult,
} from '../ai-gateway';
import { describeErrorForLog } from '../security/log-redaction';
import {
  buildCashDrivenBlock,
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

/**
 * Bump when the shape written to `AiInsight.context` changes, so historic rows stay
 * interpretable. v1 was the entire treasury context including the user's message.
 */
const AI_INSIGHT_CONTEXT_SCHEMA_VERSION = 2;

/**
 * What gets written to `AiInsight.context`.
 *
 * The previous implementation stored the whole treasury context — counterparty
 * names, raw bank narratives and the user's verbatim question — on every single AI
 * interaction, creating a second permanent copy of the customer's financial data
 * inside AI history. Nothing read it back; it existed only as history.
 *
 * This shape keeps what history is actually for: which snapshot produced this
 * answer, what kind of question it answered, which model, and whether the answer
 * was live or a fallback. `payloadDigest` is a hash of the exact payload sent to
 * the provider, so an answer can be tied to its inputs without duplicating them —
 * the underlying records remain in their own tables, as the single source of truth.
 */
interface AiInsightAudit {
  schemaVersion: number;
  feature: string;
  asOfDate: string;
  currency: string;
  /** SHA-256 (first 16 hex) of the serialised gateway payload. Not reversible. */
  payloadDigest: string | null;
  /** Headline figures the answer was based on — for troubleshooting "why did it say that?". */
  metrics: {
    openingCash: number;
    week13ClosingCash: number | null;
    runwayWeeks: number | null;
    liquidityStatus: string;
  } | null;
  /** Classification of the user's question. The question text itself is never stored. */
  questionCategory: string | null;
  /** Counts by type of what redaction removed from free text. Contains no values. */
  redactionCounts: Record<string, number> | null;
  scenarioIncluded: boolean;
  model: string;
  source: 'openai' | 'rule_based';
  latencyMs: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** Fires once per process so a misconfigured key doesn't spam identical error logs on every request. */
  private hasLoggedMissingKeyForRealCompany = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiData: AiDataService,
    private readonly gateway: AiPrivacyGatewayService,
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

    const outcome = await this.viaGateway({
      companyId,
      context,
      feature: 'chat',
      systemPrompt: buildSystemPrompt(
        input.locale,
        context.businessMode,
        context.receivablesDetail.length > 0,
        context.payablesDetail.length > 0,
      ),
      locale: input.locale,
      question: lastUser?.content,
      // The last user turn already travels as `question`; sending it again as
      // history would duplicate it, so only earlier turns are forwarded.
      history: history.slice(0, -1),
      fallback: () => this.ruleBasedChatReply(context, history, explicitIntent),
    });

    const messages = pruneMessageHistory<ChatMessage>([
      ...history,
      { role: 'assistant' as const, content: outcome.text },
    ]);

    await this.persist(companyId, 'chat', outcome, context, start);

    return {
      reply: outcome.text,
      messages,
      context,
      model: outcome.model,
      source: outcome.source,
    };
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

    const outcome = await this.viaGateway({
      companyId,
      context,
      feature: userQuestion ? 'qa' : 'dashboard.summary',
      systemPrompt: buildSystemPrompt(
        locale,
        context.businessMode,
        context.receivablesDetail.length > 0,
        context.payablesDetail.length > 0,
      ),
      locale,
      question:
        userQuestion ??
        'Provide a concise executive cash-flow briefing with 2-3 recommended actions based strictly on the structured data provided.',
      fallback: () =>
        userQuestion
          ? this.ruleBasedChatReply(
              context,
              [{ role: 'user', content: userQuestion }],
              explicitIntent,
            )
          : this.ruleBasedInsight(context),
    });

    await this.persist(
      companyId,
      userQuestion ? 'qa' : 'dashboard.summary',
      outcome,
      context,
      start,
    );

    return {
      insight: outcome.text,
      context,
      model: outcome.model,
      source: outcome.source,
    };
  }

  /** Phase 1 "Business Pulse" — a ≤120-word, plain-English daily briefing, distinct
   * prompt/format from the conversational AI CFO above (see BUSINESS_PULSE_SYSTEM_PROMPT). */
  async generateBusinessPulseBriefing(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    locale?: string,
  ): Promise<BusinessPulseBriefing> {
    const start = Date.now();
    const context = await this.aiData.buildContext(companyId);

    const localeLine = locale ? `\n${responseLanguageLine(locale)}` : '';
    const cashDrivenBlock = buildCashDrivenBlock(
      context.businessMode,
      context.receivablesDetail.length > 0,
      context.payablesDetail.length > 0,
    );

    const outcome = await this.viaGateway({
      companyId,
      context,
      feature: 'business_pulse',
      systemPrompt: BUSINESS_PULSE_SYSTEM_PROMPT + localeLine + cashDrivenBlock,
      locale,
      maxTokens: 220,
      fallback: () => this.ruleBasedBusinessPulse(context),
    });

    await this.persist(companyId, 'business_pulse', outcome, context, start);

    return { text: outcome.text, model: outcome.model, source: outcome.source };
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

    const scenarioNote = scenario
      ? ''
      : '\n\nNo scenario was modelled for this question — answer using current data only.';

    const outcome = await this.viaGateway({
      companyId,
      context,
      feature: 'decision_centre',
      systemPrompt: DECISION_CENTRE_SYSTEM_PROMPT + scenarioNote,
      locale,
      question,
      scenario,
      maxTokens: 400,
      fallback: () => this.ruleBasedDecision(context, scenario),
    });

    await this.persist(companyId, 'decision_centre', outcome, context, start);

    return { text: outcome.text, model: outcome.model, source: outcome.source };
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

    // Context is built here so the movements arrive with the liquidity picture that
    // explains them. Movement labels come from Liqvia's own KPI vocabulary.
    const context = await this.aiData.buildContext(companyId);
    const localeLine = locale ? `\n${responseLanguageLine(locale)}` : '';

    const outcome = await this.viaGateway({
      companyId,
      context,
      feature: 'why_changed',
      systemPrompt: WHY_CHANGED_SYSTEM_PROMPT + localeLine,
      locale,
      movements,
      maxTokens: 320,
      fallback: () => this.ruleBasedWhyChanged(movements),
    });

    await this.persist(companyId, 'why_changed', outcome, context, start);

    return { text: outcome.text, model: outcome.model, source: outcome.source };
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

  /**
   * Single path from an AI feature to an external model.
   *
   * Every failure mode — no key, rejected payload, provider error — lands on the
   * feature's deterministic fallback. The product never breaks because the AI is
   * unavailable, and it never leaks because the gateway said no.
   */
  private async viaGateway(options: {
    companyId: string;
    context: TreasuryAiContext;
    feature: string;
    systemPrompt: string;
    locale?: string;
    question?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    scenario?: DecisionScenarioSummary | null;
    movements?: WhyChangedMovement[];
    maxTokens?: number;
    fallback: () => string;
  }): Promise<GatewayOutcome> {
    if (!this.gateway.isConfigured()) {
      this.warnMissingApiKey(options.companyId);
      return {
        text: options.fallback(),
        model: 'rule-based-fallback:no-api-key',
        source: 'rule_based',
        result: null,
      };
    }

    try {
      const result = await this.gateway.run({
        companyId: options.companyId,
        context: options.context,
        feature: options.feature,
        systemPrompt: options.systemPrompt,
        locale: options.locale,
        question: options.question,
        history: options.history,
        scenario: options.scenario,
        movements: options.movements,
        maxTokens: options.maxTokens,
      });
      return { text: result.text, model: result.model, source: 'openai', result };
    } catch (err) {
      if (err instanceof AiPayloadRejectedError) {
        // A rejection means Liqvia tried to send something the allowlist forbids.
        // That is a defect in this codebase, not a provider outage — log it as such.
        this.logger.error(
          `AI privacy gateway blocked the "${options.feature}" payload; serving rule-based fallback. Violations: ${err.violations.slice(0, 5).join('; ')}`,
        );
        return {
          text: options.fallback(),
          model: 'rule-based-fallback:payload-rejected',
          source: 'rule_based',
          result: null,
        };
      }
      this.logger.error(
        `AI call for "${options.feature}" failed, using rule-based fallback: ${describeErrorForLog(err)}`,
      );
      return {
        text: options.fallback(),
        model: 'rule-based-fallback:api-error',
        source: 'rule_based',
        result: null,
      };
    }
  }

  /** Writes the AI log row and the minimised insight-history row. */
  private async persist(
    companyId: string,
    feature: string,
    outcome: GatewayOutcome,
    context: TreasuryAiContext,
    startedAt: number,
  ): Promise<void> {
    const latencyMs = Date.now() - startedAt;
    await this.audit(companyId, outcome.model, latencyMs);

    const payload = outcome.result?.payload ?? null;
    const audit: AiInsightAudit = {
      schemaVersion: AI_INSIGHT_CONTEXT_SCHEMA_VERSION,
      feature,
      asOfDate: context.asOfDate,
      currency: context.currency,
      payloadDigest: payload ? digestPayload(payload) : null,
      metrics: {
        openingCash: context.currentCash,
        week13ClosingCash: context.week13ClosingCash,
        runwayWeeks: context.runwayWeeks,
        liquidityStatus: context.liquidityStatus,
      },
      questionCategory: payload?.question?.category ?? context.queryAnalysis?.intent ?? null,
      redactionCounts: outcome.result?.redactionCounts ?? null,
      scenarioIncluded: Boolean(payload?.scenario),
      model: outcome.model,
      source: outcome.source,
      latencyMs,
    };

    await this.prisma.aiInsight.create({
      data: {
        companyId,
        insightType: feature,
        content: outcome.text,
        context: audit as unknown as object,
      },
    });
  }

  /** Deterministic executive briefing used when no OpenAI key is configured. */
  ruleBasedInsight(c: TreasuryAiContext): string {
    return ruleBasedReplyByIntent(c, 'cash_position', c.queryAnalysis);
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

  private async audit(companyId: string, model: string, latencyMs: number) {
    await this.prisma.aiLog.create({
      data: { companyId, model, latencyMs },
    });
  }
}

interface GatewayOutcome {
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
  result: GatewayResult | null;
}

function responseLanguageLine(locale: string): string {
  const language =
    locale === 'ru' ? 'Russian' : locale === 'es' ? 'Spanish' : locale === 'fr' ? 'French' : 'English';
  return `Respond in ${language}.`;
}

/** Short, non-reversible fingerprint tying an answer to the exact payload behind it. */
function digestPayload(payload: AiPayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}
