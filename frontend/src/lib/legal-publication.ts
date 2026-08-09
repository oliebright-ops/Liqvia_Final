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
  //
  // U3, narrowed 2026-08-10. Existence, schedule and retention are now verified
  // (see the comment block below); what remains unverified is the only part a
  // reader of the policy actually needs — where the backup objects and WAL
  // physically live. Yandex exposes no storage-region field on either the cluster
  // or the backup list, so this needs written vendor confirmation, not another
  // API call. Do not publish an unconditional "backups are held in Russia".
  'регион физического хранения резервных копий и журналов WAL — U3',
  // ── Resolved 2026-08-10 by docs/RU_CURRENT_LEAD_DATA_FLOW.md and
  //    docs/RU_METRICA_VERIFICATION.md; struck from this list rather than left
  //    outstanding, because a document that says "not established" about a fact
  //    that has been established is as untrue as one that invents a fact:
  //      U1  web-service region — read directly from the API on 2026-08-10:
  //          VM liqvia-ru-app (fhmd7dqno1g3u84n8jad), zone ru-central1-a,
  //          RUNNING, public IPv4 158.160.44.137. That address is the one
  //          liqvia.info resolves to, and it sits in Yandex's Russian-registered
  //          158.160.0.0/16 (RIPE RU-YANDEXCLOUD, country RU) — so DNS, address
  //          registration and the resource's own zone all agree.
  //      U2  database region — read directly from the API on 2026-08-10:
  //          cluster c9q985emaom0p6128t5r (liqvia-ru-leads), master host
  //          rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net, zone_id ru-central1-a,
  //          environment PRODUCTION, health ALIVE. Evidence and the exact
  //          commands: docs/RU_DATABASE_CONFIGURATION.md §4.2.
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
