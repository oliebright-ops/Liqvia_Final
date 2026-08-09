import { Injectable, Logger } from '@nestjs/common';
import { buildAiPayload, type BuildPayloadOptions } from './decision-context';
import { aiPayloadSchema, findProhibitedKeys, type AiPayload } from './payload-schema';
import { redactFreeText } from './redaction';
import {
  AiProviderUnavailableError,
  OpenAiProvider,
  type ProviderMessage,
} from './providers/openai.provider';

/**
 * The single door between Liqvia and any external AI provider.
 *
 * Every AI feature calls `run()`. Nothing else in the codebase constructs a request
 * to a model. The gateway's contract is narrow on purpose:
 *
 *   internal treasury context  →  deterministic projection  →  allowlist validation
 *   →  prohibited-key sweep  →  provider adapter
 *
 * Validation is fail-closed. If the payload does not match `aiPayloadSchema`
 * exactly — including rejecting any key the schema does not name — the call is
 * abandoned and the caller falls back to its deterministic rule-based answer. A
 * degraded answer is an acceptable outcome; an unreviewed field reaching a US
 * processor is not.
 */

export class AiPayloadRejectedError extends Error {
  constructor(
    message: string,
    readonly violations: string[],
  ) {
    super(message);
    this.name = 'AiPayloadRejectedError';
  }
}

export interface GatewayRunOptions extends BuildPayloadOptions {
  /** Feature-specific system prompt. Must not interpolate customer data. */
  systemPrompt: string;
  /** Prior turns of a conversation. Redacted like any other free text. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  /** Identifies the calling feature in logs and telemetry. */
  feature: string;
}

export interface GatewayResult {
  text: string;
  model: string;
  /** The exact object that was serialised to the provider — for tests and audit. */
  payload: AiPayload;
  redactionCounts: Record<string, number>;
}

/**
 * Explains the payload's own conventions to the model, so pseudonymous codes and
 * materiality buckets are usable rather than mysterious. Without this the codes
 * would cost answer quality; with it they do not.
 */
const PAYLOAD_CONTRACT_PROMPT = `You receive a privacy-preserving structured summary of a business's cash position, not raw records.

Reading the payload:
- Counterparties appear as stable pseudonymous codes (CUSTOMER_C014, SUPPLIER_S077, OBLIGATION_O231). Each code is one real counterparty. Treat different codes as different businesses, and refer to them by their code.
- You will never be given names, contact details, account numbers or bank transaction narratives. Do not ask for them, do not guess them, and do not invent them.
- "cashImpact" is computed by the platform: CRITICAL = 25%+ of current cash or 4+ weeks of burn; HIGH = 10%+ or 2+ weeks; MODERATE = 3%+ or 0.5 weeks; LOW = below that.
- "dueWeek" is weeks relative to meta.asOfDate. Negative means already past due.
- "shareOfTotalPct" is that item's share of total receivables or payables — use it to reason about concentration.
- "collectionConfidence" is an ageing-based estimate from the platform, not a promise.
- "cashFlowCategories" are aggregates the platform derived from bank data by local classification.
- All figures are already calculated by Liqvia's deterministic engine. Cite them; never recompute or extrapolate beyond them.
- If a field is absent, say the data is not available rather than assuming a value.`;

@Injectable()
export class AiPrivacyGatewayService {
  private readonly logger = new Logger(AiPrivacyGatewayService.name);

  constructor(private readonly provider: OpenAiProvider) {}

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  model(): string {
    return this.provider.model();
  }

  /**
   * Builds, validates and sends a payload.
   *
   * @throws {AiPayloadRejectedError} when the projection produced something the
   *   allowlist does not permit — a bug in Liqvia, surfaced loudly rather than sent.
   * @throws {AiProviderUnavailableError} on any provider-side failure.
   */
  async run(options: GatewayRunOptions): Promise<GatewayResult> {
    const { payload, registry, redactionCounts } = buildAiPayload(options);

    const validated = this.validate(payload, options.feature);

    const messages: ProviderMessage[] = [
      { role: 'system', content: `${options.systemPrompt}\n\n${PAYLOAD_CONTRACT_PROMPT}` },
      {
        role: 'user',
        content: `Structured financial context (JSON):\n${JSON.stringify(validated, null, 2)}`,
      },
    ];

    // Conversation history is user-authored free text and gets the same treatment
    // as the question itself, including counterparty-name substitution.
    for (const turn of options.history ?? []) {
      messages.push({
        role: turn.role,
        content: redactFreeText(turn.content, registry).text,
      });
    }

    const response = await this.provider.complete({
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    return { text: response.text, model: response.model, payload: validated, redactionCounts };
  }

  /**
   * Fail-closed validation. Exposed separately so tests can assert on the boundary
   * without performing a network call.
   */
  validate(payload: unknown, feature: string): AiPayload {
    // 1. Allowlist. `.strict()` throughout means unknown keys are errors, not noise.
    const parsed = aiPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw this.rejection(
        feature,
        parsed.error.issues.map((i) => `${i.path.join('.') || '$'}: ${i.message}`),
      );
    }

    // 2. Independent sweep for prohibited key names at any depth. Redundant with
    //    step 1 by design — two mechanisms, one failure mode.
    const prohibited = findProhibitedKeys(parsed.data);
    if (prohibited.length > 0) {
      throw this.rejection(
        feature,
        prohibited.map((p) => `${p}: prohibited field name`),
      );
    }

    return parsed.data;
  }

  private rejection(feature: string, violations: string[]): AiPayloadRejectedError {
    // Field *paths* only. Never the offending values — that would move the leak
    // from the provider to the log sink.
    this.logger.error(
      `AI payload rejected for feature "${feature}": ${violations.slice(0, 10).join('; ')}`,
    );
    return new AiPayloadRejectedError(
      `Payload rejected by AI privacy gateway (${violations.length} violation(s))`,
      violations,
    );
  }
}

export { AiProviderUnavailableError };
