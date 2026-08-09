/**
 * Re-export of the canonical consent registry and operator identity so client
 * components can import them without reaching across workspace packages
 * directly in JSX files.
 *
 * The single source of truth is `packages/shared/src/consent.ts` and
 * `packages/shared/src/operator.ts`.
 */
export {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
  CONSENT_DOCUMENT_PATH,
  CONSENT_LINK_PHRASES,
  CONSENT_POLICY_VERSION,
  CONSENT_REQUIRED_MESSAGE_RU,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  PRIVACY_POLICY_PATH,
  REQUIRED_LEAD_CONSENT_SUBJECT,
  activeConsentEntry,
  lookupConsentText,
  segmentConsentText,
} from '@liqvia2/shared';
export type {
  ConsentObligation,
  ConsentSubjectId,
  ConsentTextEntry,
  ConsentTextSegment,
} from '@liqvia2/shared';

/**
 * Public operator identity only.
 *
 * `operatorPrivateConfig` is deliberately NOT re-exported here: it is server-only
 * and throws in a browser. Anything added to this list becomes readable by every
 * visitor, so it must be information the site is required to publish.
 */
export {
  OPERATOR_CONTACT_EMAIL,
  OPERATOR_FULL_NAME,
  OPERATOR_IDENTIFICATION_RU,
  OPERATOR_REQUESTS_ADDRESS_RU,
  OPERATOR_SHORT_DESIGNATION_RU,
  OPERATOR_STATUS_RU,
  assertOperatorDesignation,
  isOperatorContactVerified,
  missingOperatorContactFacts,
} from '@liqvia2/shared';
