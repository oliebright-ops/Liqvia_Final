import { Injectable, Logger } from '@nestjs/common';
import { describeErrorForLog } from '../../security/log-redaction';

/**
 * THE ONLY MODULE IN THIS REPOSITORY PERMITTED TO CONTACT AN EXTERNAL AI PROVIDER.
 *
 * Enforced three ways:
 *  1. `eslint.config.mjs` — `no-restricted-imports` / `no-restricted-syntax` rules
 *     that fail lint on an OpenAI import or endpoint literal outside this folder.
 *  2. `ai-boundary.spec.ts` — a repository scan that fails CI on the same thing.
 *  3. Code review: this file is small on purpose, so a diff to it is conspicuous.
 *
 * It accepts an already-validated string and knows nothing about treasury data. All
 * privacy decisions happen upstream in `AiPrivacyGatewayService`; putting them here
 * would mean a second caller could skip them.
 */

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 30_000;

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderRequest {
  messages: ProviderMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ProviderResponse {
  text: string;
  model: string;
}

export class AiProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderUnavailableError';
  }
}

@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  model(): string {
    return process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new AiProviderUnavailableError('OPENAI_API_KEY is not set');

    const model = this.model();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
          ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        // Status only. An error body from a provider can echo the request payload.
        throw new AiProviderUnavailableError(`OpenAI request failed: HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new AiProviderUnavailableError('OpenAI returned an empty response');

      return { text, model };
    } catch (err) {
      if (err instanceof AiProviderUnavailableError) throw err;
      this.logger.warn(`OpenAI call failed: ${describeErrorForLog(err)}`);
      throw new AiProviderUnavailableError('OpenAI call failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}
