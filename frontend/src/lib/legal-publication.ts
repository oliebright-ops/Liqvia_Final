/**
 * Publication gate for the two legal documents on the Russian landing page.
 *
 * A privacy policy or a consent notice that names an unmonitored mailbox, an
 * invented address, or a hosting region nobody has verified is worse than one
 * that is visibly a draft: it is a published statement of fact that is untrue.
 * So the pages do not decide for themselves whether they are published — they
 * ask here, and while the answer is `false` they render a draft banner, refuse
 * to assert unverified facts, and stay out of search indexes.
 *
 * Flipping `COUNSEL_SIGN_OFF_COMPLETE` is a human decision recorded in
 * `docs/legal/RU_CONSENT_IMPLEMENTATION.md`. Do not flip it to make a test pass.
 */
import {
  OPERATOR_CONTACT_EMAIL,
  OPERATOR_REQUESTS_ADDRESS_RU,
  isOperatorContactVerified,
  isOperatorPostalAddressVerified,
  missingOperatorContactFacts,
} from './consent';

/**
 * Facts about the processing itself that neither this repository nor the
 * operator has yet established. Each one is asserted nowhere in the published
 * documents until it moves out of this list.
 *
 * Sources: docs/FINAL_OUTSTANDING_ISSUES.md §3 (U1–U12).
 */
export const UNVERIFIED_PROCESSING_FACTS: readonly string[] = Object.freeze([
  // Resolved only when the RU infrastructure exists and its console has been read.
  'регион размещения веб-сервиса — U1',
  'регион размещения базы данных, подтверждённый в консоли — U2',
  'наличие, периодичность, срок и место хранения резервных копий — U3',
  // ── Resolved 2026-08-10 by docs/RU_CURRENT_LEAD_DATA_FLOW.md and
  //    docs/RU_METRICA_VERIFICATION.md; struck from this list rather than left
  //    outstanding, because a document that says "not established" about a fact
  //    that has been established is as untrue as one that invents a fact:
  //      U6  SMTP — no lead email path exists at all
  //      U7  OpenAI — no lead data reaches any AI provider, so the terms do not apply
  //      U8/U9 Metrica — Webvisor verified off live; no form-content recording
  //      Y10 retention — owner decision: leads 1 month; consent evidence separate
]);

/**
 * Whether the operator has approved the current wording for publication.
 *
 * NOT a statement that a lawyer reviewed it. The two are deliberately separate
 * constants so that no future reader can mistake one for the other, and so that
 * flipping this can never silently imply legal sign-off.
 */
export const OWNER_APPROVED_FOR_PUBLICATION = true;

/** True only when qualified external counsel has reviewed the published wording. */
export const EXTERNAL_LEGAL_REVIEW_COMPLETE = false;

/**
 * Internal-only status line. Never rendered to the public.
 *
 * Visitors are not told whether the operator engaged a lawyer — that is not
 * information a data subject needs, and publishing it would undermine documents
 * the operator has approved as accurate. What a visitor is owed is that every
 * statement in the documents is true and every promised channel works.
 */
export const LEGAL_REVIEW_STATUS = OWNER_APPROVED_FOR_PUBLICATION
  ? EXTERNAL_LEGAL_REVIEW_COMPLETE
    ? 'LEGAL REVIEWED'
    : 'OWNER-APPROVED FOR PUBLICATION — NOT EXTERNALLY LEGALLY REVIEWED'
  : 'DRAFT — NOT APPROVED FOR PUBLICATION';

/**
 * True when the documents may be presented as published.
 *
 * Gated on facts, not on opinions: the operator can be reached, no statement in
 * the documents is still a placeholder, and the operator has approved the
 * wording. External legal review is tracked separately and does not gate
 * publication — that is the owner's decision, recorded above.
 */
export function isLegalPublicationReady(): boolean {
  return (
    isOperatorContactVerified() &&
    UNVERIFIED_PROCESSING_FACTS.length === 0 &&
    OWNER_APPROVED_FOR_PUBLICATION
  );
}

/** Everything still blocking publication, in the order a reader should fix it. */
export function publicationBlockers(): string[] {
  const blockers: string[] = [];
  if (!isOperatorContactVerified()) {
    blockers.push(...missingOperatorContactFacts());
  }
  blockers.push(...UNVERIFIED_PROCESSING_FACTS);
  if (!OWNER_APPROVED_FOR_PUBLICATION) {
    blockers.push('утверждение формулировок владельцем');
  }
  return blockers;
}

/**
 * Open owner inputs that do not block publication.
 *
 * Kept out of `publicationBlockers` so the two questions stay distinct: "is this
 * document safe to publish?" and "is there still something outstanding?".
 */
export function openOwnerInputs(): string[] {
  const open: string[] = [];
  if (!isOperatorPostalAddressVerified()) {
    open.push('OWNER INPUT REQUIRED — POSTAL ADDRESS');
  }
  if (!EXTERNAL_LEGAL_REVIEW_COMPLETE) {
    open.push('EXTERNAL LEGAL REVIEW NOT PERFORMED');
  }
  return open;
}

/**
 * The contact block for legally significant requests, or `null` while the
 * operator cannot be reached at all.
 *
 * `address` is `string | null` and the two fields are independent. They used to
 * be all-or-nothing, which had a perverse effect: with a verified mailbox and no
 * postal address, the pages rendered «НЕ УСТАНОВЛЕНО» over a contact channel
 * that actually worked, telling the reader they had no way to reach the operator
 * when they did. Suppressing a working channel is not caution.
 *
 * Callers must render a `null` address by omitting the postal line — never as a
 * placeholder, and never by inventing one.
 */
export function operatorContactBlock(): { email: string; address: string | null } | null {
  if (!isOperatorContactVerified()) return null;
  return {
    email: OPERATOR_CONTACT_EMAIL as string,
    address: isOperatorPostalAddressVerified() ? (OPERATOR_REQUESTS_ADDRESS_RU as string) : null,
  };
}
