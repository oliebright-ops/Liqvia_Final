import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiDataService } from './ai-data.service';
import {
  buildSystemPrompt,
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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

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
        this.logger.warn(`OpenAI chat failed, using rule-based fallback: ${String(err)}`);
        reply = this.ruleBasedChatReply(context, history, explicitIntent);
        model = 'rule-based-fallback';
        source = 'rule_based';
      }
    } else {
      reply = this.ruleBasedChatReply(context, history, explicitIntent);
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
        this.logger.warn(`OpenAI insight failed, using rule-based fallback: ${String(err)}`);
        insight = userQuestion
          ? this.ruleBasedChatReply(
              context,
              [{ role: 'user', content: userQuestion }],
              explicitIntent,
            )
          : this.ruleBasedInsight(context);
        model = 'rule-based-fallback';
        source = 'rule_based';
      }
    } else {
      insight = userQuestion
        ? this.ruleBasedChatReply(
            context,
            [{ role: 'user', content: userQuestion }],
            explicitIntent,
          )
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
