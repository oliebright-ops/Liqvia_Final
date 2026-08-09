/**
 * Public surface of the AI privacy gateway.
 *
 * Importing anything from `./providers/*` outside this folder is a lint error and a
 * CI failure — see `ai-boundary.spec.ts`.
 */
export { AiGatewayModule } from './ai-gateway.module';
export {
  AiPrivacyGatewayService,
  AiPayloadRejectedError,
  AiProviderUnavailableError,
} from './ai-privacy-gateway.service';
export type { GatewayResult, GatewayRunOptions } from './ai-privacy-gateway.service';
export { buildAiPayload } from './decision-context';
export type { BuildPayloadOptions, BuiltPayload } from './decision-context';
export { aiPayloadSchema, findProhibitedKeys, PROHIBITED_KEY_PATTERNS } from './payload-schema';
export type { AiPayload } from './payload-schema';
export { redactFreeText, safeLabel, MAX_FREE_TEXT_LENGTH } from './redaction';
export { CounterpartyRegistry } from './pseudonymise';
