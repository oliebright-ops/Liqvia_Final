/**
 * Builds the body of a landing-page lead submission.
 *
 * This lives outside the component on purpose: what the form sends is worth
 * asserting in an ordinary test (`lead-submission.test.ts`) rather than only by
 * driving a browser, and it leaves the component with one decision — send this.
 *
 * The form shows a passive notice, not a checkbox, so there is no acknowledgement
 * event for the client to report and this payload deliberately carries no
 * `consent` object. The server records which notice was displayed from its own
 * copy of the registry; frontend and backend ship in the same image, so that is
 * provably the wording this page rendered, and it cannot be forged by a caller.
 *
 * The optional marketing box is unaffected. It is a real tick when it is shown at
 * all, so it still travels as evidence — and it is currently never shown, because
 * `MARKETING_CONSENT_ENABLED` is false.
 */
import type { LeadAttribution } from '@liqvia2/shared';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
} from './consent';

/** Identifies the form that produced a lead, and is stored on its consent record. */
export const LEAD_FORM_SOURCE = 'cash-operating-system-landing';

export interface LeadFormValues {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  employeeCount: string;
  industry: string;
  comment: string;
}

/**
 * What the user actually did with the optional marketing box.
 *
 * The timestamp is captured when the box is ticked, not when the form is sent:
 * the tick is the acknowledgement, and someone may sit on a filled form for a
 * while before sending it.
 */
export interface MarketingConsentState {
  marketingGiven: boolean;
  marketingAcknowledgedAt: string | null;
}

export interface ConsentEvidence {
  subjectId: string;
  version: string;
  consentText: string;
  locale: string;
  accepted: true;
  acknowledgedAt: string;
}

export interface LeadPayload {
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  employeeCount?: string;
  industry?: string;
  comment?: string;
  source: string;
  marketingConsent?: ConsentEvidence;
  /**
   * Campaign metadata for the visit, omitted entirely when the visit carried no
   * tags. Sent as a nested object rather than flattened into the lead's own
   * fields, so that "what the person typed" and "what the advert was" stay
   * visibly separate all the way down to the database.
   */
  attribution?: LeadAttribution;
}

/**
 * @param nowIso Injected so a test can assert the fallback timestamp. Production
 *   callers omit it.
 */
export function buildLeadPayload(
  values: LeadFormValues,
  marketing: MarketingConsentState,
  nowIso: () => string = () => new Date().toISOString(),
  attribution: LeadAttribution = {},
): LeadPayload {
  const payload: LeadPayload = {
    name: values.name,
    companyName: values.companyName,
    email: values.email,
    phone: values.phone || undefined,
    employeeCount: values.employeeCount || undefined,
    industry: values.industry || undefined,
    comment: values.comment || undefined,
    source: LEAD_FORM_SOURCE,
  };

  // Present only when the optional box exists and was ticked. Its absence is what
  // records "no marketing consent" — it is never inferred from the submission.
  if (MARKETING_CONSENT_ENABLED && marketing.marketingGiven && CASH_OS_LEAD_MARKETING_CONSENT_TEXT) {
    payload.marketingConsent = {
      subjectId: MARKETING_LEAD_CONSENT_SUBJECT,
      version: ACTIVE_CONSENT_VERSION[MARKETING_LEAD_CONSENT_SUBJECT],
      consentText: CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
      locale: 'ru',
      accepted: true,
      acknowledgedAt: marketing.marketingAcknowledgedAt ?? nowIso(),
    };
  }

  // Omitted rather than sent empty, so an untagged visit is recorded as having no
  // attribution rather than as having blank attribution.
  if (Object.keys(attribution).length > 0) {
    payload.attribution = attribution;
  }

  return payload;
}
