# AI Safety and Validation

## Principles

- Never expose one company's data to another (validate `companyId` on every AI request)
- Redact PII in logs where possible; mask account numbers
- AI outputs are advisory, not accounting advice — surface disclaimer in UI
- Reject prompts that request actions outside allowed tools (MVP: read-only commentary)

## Validation

- Verify treasury context is fresh (timestamp, forecast version id)
- Cap token usage and message length
- Rate limit per company / user

## Audit

- Persist `AiLog`: userId, companyId, prompt hash, model, tokens, latency
- Store generated `AiInsight` linked to dashboard cards

## Multilingual

Generate in user locale; fall back to English if translation unavailable.
