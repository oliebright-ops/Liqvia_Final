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
  'регион размещения веб-сервиса (Render) — U1',
  'регион размещения базы данных, подтверждённый в консоли — U2',
  'наличие, периодичность, срок и место хранения резервных копий — U3',
  'поставщик услуг электронной почты (SMTP) — U6',
  'действующие условия обработки данных OpenAI (срок хранения, отказ от обучения) — U7',
  'настройки Яндекс.Метрики: Вебвизор, запись содержимого форм — U8/U9',
  'сроки хранения по каждой категории данных — Y10',
]);

/** Set to true only when qualified counsel has signed off the published wording. */
export const COUNSEL_SIGN_OFF_COMPLETE = false;

/**
 * True only when every gate is clear: the operator's contact channels are real,
 * no processing fact is still unverified, and counsel has signed off.
 */
export function isLegalPublicationReady(): boolean {
  return (
    isOperatorContactVerified() &&
    UNVERIFIED_PROCESSING_FACTS.length === 0 &&
    COUNSEL_SIGN_OFF_COMPLETE
  );
}

/** Everything still blocking publication, in the order a reader should fix it. */
export function publicationBlockers(): string[] {
  const blockers = missingOperatorContactFacts();
  blockers.push(...UNVERIFIED_PROCESSING_FACTS);
  if (!COUNSEL_SIGN_OFF_COMPLETE) {
    blockers.push('проверка формулировок квалифицированным юристом');
  }
  return blockers;
}

/**
 * The contact block for legally significant requests, or `null` while the
 * operator has not supplied verified details. Callers must render the `null`
 * case as "not yet published" — never as a placeholder.
 */
export function operatorContactBlock(): { email: string; address: string } | null {
  if (!isOperatorContactVerified()) return null;
  return {
    email: OPERATOR_CONTACT_EMAIL as string,
    address: OPERATOR_REQUESTS_ADDRESS_RU as string,
  };
}
