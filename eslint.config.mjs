import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * AI provider boundary.
 *
 * Only `backend/src/ai-gateway/providers/**` may import an AI provider SDK or name a
 * provider endpoint. Everything else must go through `AiPrivacyGatewayService`, which
 * validates the payload against an explicit allowlist first.
 *
 * This is enforced twice on purpose — here, and in
 * `backend/src/ai-gateway/ai-boundary.spec.ts` — because a lint rule can be disabled
 * with a comment and a test cannot be disabled quietly.
 */
const AI_PROVIDER_PACKAGES = [
  'openai',
  '@ai-sdk/openai',
  'langchain',
  '@langchain/openai',
  '@anthropic-ai/sdk',
  '@google/generative-ai',
  '@mistralai/mistralai',
  'cohere-ai',
  'ollama',
];

const AI_BOUNDARY_MESSAGE =
  'Direct AI provider access is not allowed here. Route the call through AiPrivacyGatewayService (backend/src/ai-gateway) so the payload is validated against the allowlist. Only backend/src/ai-gateway/providers/** may talk to a provider.';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    ignores: ['backend/src/ai-gateway/providers/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: AI_PROVIDER_PACKAGES.map((name) => ({ name, message: AI_BOUNDARY_MESSAGE })),
          patterns: [
            {
              group: ['**/ai-gateway/providers/*', '**/ai-gateway/providers'],
              message: AI_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/api\\.openai\\.com/]",
          message: AI_BOUNDARY_MESSAGE,
        },
        {
          selector: "TemplateElement[value.raw=/api\\.openai\\.com/]",
          message: AI_BOUNDARY_MESSAGE,
        },
        {
          selector: "Literal[value=/(anthropic|generativelanguage\\.googleapis|api\\.mistral|api\\.cohere)\\.com?/]",
          message: AI_BOUNDARY_MESSAGE,
        },
      ],
    },
  },
  {
    // The boundary test and this config both need to name the things they forbid.
    files: [
      'backend/src/ai-gateway/ai-boundary.spec.ts',
      'eslint.config.mjs',
    ],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
