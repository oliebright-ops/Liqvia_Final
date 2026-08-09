/**
 * Builds the body of a landing-page lead submission — and refuses to build one
 * at all while the required consent has not been ticked.
 *
 * This lives outside the component on purpose. "The form does not submit without
 * consent" is the single most important behaviour on the page, and a rule that
 * only exists inside an event handler can only be verified by driving a browser.
 * Here it is an ordinary function with an ordinary test
 * (`lead-submission.test.ts`), and the component has one decision left: send what
 * this returns, or don't.
 *
 * The consent evidence is assembled from the shared registry rather than from
 * anything typed here, so the wording sent as evidence is by construction the
 * wording the label rendered.
 */
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
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
 * What the user actually did with the two boxes.
 *
 * The timestamps are captured when a box is ticked, not when the form is sent:
 * the tick is the acknowledgement, and someone may sit on a filled form for a
 * while before sending it.
 */
export interface ConsentState {
  consentGiven: boolean;
  consentAcknowledgedAt: string | null;
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
  consent: ConsentEvidence;
  marketingConsent?: ConsentEvidence;
}

export type LeadSubmission =
  | { blocked: true; reason: 'consent-not-given' }
  | { blocked: false; payload: LeadPayload };

/**
 * @param nowIso Injected so a test can assert the fallback timestamp. Production
 *   callers omit it.
 */
export function buildLeadSubmission(
  values: LeadFormValues,
  consent: ConsentState,
  nowIso: () => string = () => new Date().toISOString(),
): LeadSubmission {
  if (!consent.consentGiven) {
    return { blocked: true, reason: 'consent-not-given' };
  }

  const payload: LeadPayload = {
    name: values.name,
    companyName: values.companyName,
    email: values.email,
    phone: values.phone || undefined,
    employeeCount: values.employeeCount || undefined,
    industry: values.industry || undefined,
    comment: values.comment || undefined,
    source: LEAD_FORM_SOURCE,
    consent: {
      subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
      version: ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT],
      consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT,
      locale: 'ru',
      accepted: true,
      acknowledgedAt: consent.consentAcknowledgedAt ?? nowIso(),
    },
  };

  // Present only when the optional box exists and was ticked. Its absence is what
  // records "no marketing consent" — never a false flag on the required consent.
  if (MARKETING_CONSENT_ENABLED && consent.marketingGiven && CASH_OS_LEAD_MARKETING_CONSENT_TEXT) {
    payload.marketingConsent = {
      subjectId: MARKETING_LEAD_CONSENT_SUBJECT,
      version: ACTIVE_CONSENT_VERSION[MARKETING_LEAD_CONSENT_SUBJECT],
      consentText: CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
      locale: 'ru',
      accepted: true,
      acknowledgedAt: consent.marketingAcknowledgedAt ?? nowIso(),
    };
  }

  return { blocked: false, payload };
}
