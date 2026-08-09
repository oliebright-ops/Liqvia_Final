/**
 * Identity of the personal-data operator for the Russian landing page
 * (`liqvia.info`) and every legal document it links to.
 *
 * This file is the ONLY place the operator is described. `/privacy`, `/consent`,
 * the lead-form consent wording and the server-side consent registry all read
 * from here, so the identification can never drift between documents.
 *
 * The operator is a natural person who is NOT registered as an individual
 * entrepreneur. Consequences, enforced by `assertOperatorDesignation` and by
 * `operator.spec.ts`:
 *   - never describe the operator as «ИП» / «Индивидуальный предприниматель»;
 *   - never request, store or display an ОГРНИП (a natural person has none);
 *   - never substitute «Liqvia», «Администрация сайта» or any other ambiguous
 *     designation for the operator's name in a legal document.
 *
 * Nothing here may be invented. `null` means "not yet verified by the operator"
 * and is deliberately load-bearing: see `isOperatorContactVerified`.
 *
 * ## Public identity vs private configuration
 *
 * This module exports ONLY the operator facts that a public legal document is
 * required to carry. Anything else — tax identifiers, registration numbers,
 * internal references — is deliberately absent, because everything exported here
 * is imported by the frontend and therefore ends up in a client bundle that any
 * visitor can read.
 *
 * The operator's ИНН is NOT here. 152-FZ requires a personal-data policy and a
 * consent notice to identify the operator by name and to give an address for
 * requests; neither names a tax identifier as required content. Publishing an
 * individual's ИНН is therefore a voluntary disclosure of an extra identifier
 * about a natural person, which is exactly what data minimisation argues against.
 *
 * If counsel later confirms an ИНН must appear in a specific public notice, add
 * it to that notice's wording as a NEW consent version, sourced from server-side
 * configuration (`operatorPrivateConfig()` below) — never as a constant in this
 * file, and never in a module the frontend imports.
 *
 * LEGAL REVIEW REQUIRED: whether any additional identifier must be published.
 */

/** Full name of the operator, as it must appear in every legal document. */
export const OPERATOR_FULL_NAME = 'Оли Брайт Бабатунде';

/**
 * Dative case, required by the consent wording («Я даю <кому> …»).
 * Kept explicit rather than derived, because Russian declension of a
 * transliterated name is not mechanically derivable.
 */
export const OPERATOR_FULL_NAME_DATIVE = 'Оли Брайту Бабатунде';

/**
 * Genitive case, required by the marketing wording («сообщения от <кого> …»).
 * Explicit for the same reason as the dative form above.
 */
export const OPERATOR_FULL_NAME_GENITIVE = 'Оли Брайта Бабатунде';

/** Legal status. The operator is a natural person, not a registered entrepreneur. */
export const OPERATOR_STATUS_RU = 'физическое лицо, не индивидуальный предприниматель';

/**
 * Short form used inline in running text.
 *
 * Name plus legal status, and nothing else. The status is load-bearing — it is
 * what tells a reader which legal regime the operator falls under — whereas a
 * tax identifier only makes the natural person behind the site more identifiable
 * to anyone who reads the page.
 */
export const OPERATOR_SHORT_DESIGNATION_RU = `${OPERATOR_FULL_NAME}, физическое лицо`;

/**
 * The canonical identification line. Required verbatim on `/privacy` and
 * `/consent` and wherever the operator must be identified.
 */
export const OPERATOR_IDENTIFICATION_RU =
  `Оператор персональных данных: ${OPERATOR_SHORT_DESIGNATION_RU}`;

/**
 * Contact email for personal-data requests and consent withdrawal.
 *
 * Verified by the operator on 2026-08-10. This is the channel through which a
 * data subject exercises every right the published documents promise: access,
 * correction, deletion, and withdrawal of consent.
 *
 * It is deliberately NOT used for marketing or promotional messages — see
 * `MARKETING_CONSENT_ENABLED` in `consent.ts`, which remains false.
 *
 * DO NOT put a placeholder here. Only a real, monitored mailbox.
 */
export const OPERATOR_CONTACT_EMAIL: string | null = 'olie.bright@gmail.com';

/**
 * Postal address for legally significant requests.
 *
 * Deliberately `null`, and deliberately load-bearing. No verified address has
 * been supplied, and one must never be inferred from account details, Git
 * history, registration records, WHOIS, tax data or any other personal source.
 * Publishing a residential address that nobody chose to publish is a harm in
 * itself, and an invented one is a false statement in a legal document.
 *
 * Its absence does not block publication — see `isOperatorContactVerified` — but
 * it is tracked as an open owner input. 152-FZ does contemplate circumstances in
 * which an operator's address must be disclosed, so whether the documents can
 * stand indefinitely without one is a legal question, not a technical one.
 *
 * LEGAL REVIEW REQUIRED. Recorded as OWNER INPUT REQUIRED — POSTAL ADDRESS.
 */
export const OPERATOR_REQUESTS_ADDRESS_RU: string | null = null;

/** Whether a real mailbox exists for subject requests and consent withdrawal. */
export function isOperatorEmailVerified(): boolean {
  return typeof OPERATOR_CONTACT_EMAIL === 'string' && OPERATOR_CONTACT_EMAIL.trim().length > 0;
}

/** Whether a postal address has been supplied for legally significant requests. */
export function isOperatorPostalAddressVerified(): boolean {
  return (
    typeof OPERATOR_REQUESTS_ADDRESS_RU === 'string' &&
    OPERATOR_REQUESTS_ADDRESS_RU.trim().length > 0
  );
}

/**
 * True when the operator can actually be reached about their processing.
 *
 * A working email satisfies this. The postal address is intentionally NOT part
 * of the condition: requiring both meant that supplying a verified mailbox
 * changed nothing, and the documents went on rendering «НЕ УСТАНОВЛЕНО» over a
 * channel that genuinely worked — which is its own kind of untrue statement.
 *
 * What matters for publication is that every right the documents promise is
 * exercisable. Access, correction, deletion and withdrawal are all exercisable
 * by email. See `isOperatorPostalAddressVerified` for the separate question.
 */
export function isOperatorContactVerified(): boolean {
  return isOperatorEmailVerified();
}

/**
 * Contact facts still missing.
 *
 * The postal address appears here — so it stays visible in internal tooling and
 * in the publication blocker list — without gating publication.
 */
export function missingOperatorContactFacts(): string[] {
  const missing: string[] = [];
  if (!isOperatorEmailVerified()) {
    missing.push('подтверждённый адрес электронной почты для обращений');
  }
  if (!isOperatorPostalAddressVerified()) {
    missing.push('почтовый адрес для юридически значимых обращений (OWNER INPUT REQUIRED)');
  }
  return missing;
}

/* ------------------------------------------------------------------------- */
/* Private configuration                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Operator facts that exist for operational reasons but are NOT published.
 *
 * Read from the environment, never from a constant, so that no value here can be
 * committed to Git or tree-shaken into a browser bundle. Every field is optional:
 * nothing in the public site may depend on one being present.
 *
 * `RU_OPERATOR_INN` is supplied only where a counterparty, a hosting contract or
 * a tax filing genuinely needs it. It must never be interpolated into a consent
 * notice, a privacy policy, a page title, an analytics parameter or a log line.
 */
export interface OperatorPrivateConfiguration {
  /** Tax identifier. Operational use only — see the module header. */
  readonly inn?: string;
  /** Internal registration/reference data, if any is ever needed. */
  readonly registrationReference?: string;
}

/**
 * Server-side accessor for the non-public operator facts.
 *
 * Throws when called from a browser: this is the mechanism that keeps a private
 * identifier out of the client bundle even if someone imports it by mistake.
 */
export function operatorPrivateConfig(): OperatorPrivateConfiguration {
  if (typeof window !== 'undefined') {
    throw new Error(
      'operatorPrivateConfig() is server-only. Private operator identifiers must ' +
        'never reach a client bundle.',
    );
  }
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return Object.freeze({
    inn: env?.RU_OPERATOR_INN?.trim() || undefined,
    registrationReference: env?.RU_OPERATOR_REGISTRATION_REF?.trim() || undefined,
  });
}

/* ------------------------------------------------------------------------- */
/* Designation guard                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Designations that must never appear in operator-facing legal text.
 *
 * `индивидуальный предприниматель` is intentionally NOT a blanket ban: the
 * status line legitimately contains it inside the negation «не индивидуальный
 * предприниматель». `assertOperatorDesignation` checks for the affirmative use.
 */
const FORBIDDEN_LITERALS = ['ОГРНИП', 'ИНН/ОГРНИП'];

/**
 * A tax identifier quoted in public wording, e.g. «ИНН 000000000000».
 *
 * Guarded rather than merely omitted: the constant is gone, but a future edit
 * could paste one back in, and the point of this file is that public legal text
 * carries only what it must. Removing this check is a legal decision, not a
 * refactor — see the module header.
 */
const PUBLISHED_TAX_IDENTIFIER = /ИНН\s*[:№]?\s*\d{4,}/u;

/** Affirmative «индивидуальный предприниматель», i.e. not preceded by «не ». */
const AFFIRMATIVE_ENTREPRENEUR = /(?<!не\s)индивидуальн(ый|ым|ого|ому|ом)\s+предпринимател/iu;

/** Standalone «ИП» used as a designation (not part of a longer word). */
const IP_ABBREVIATION = /(^|[\s(«"])ИП([\s).,;:»"]|$)/u;

/**
 * Throws when text describes the operator in a prohibited way.
 *
 * Called by the consent registry on every registered wording, and asserted over
 * the rendered legal pages by their specs, so a prohibited designation cannot
 * reach production unnoticed.
 */
export function assertOperatorDesignation(text: string, where: string): void {
  for (const literal of FORBIDDEN_LITERALS) {
    if (text.includes(literal)) {
      throw new Error(
        `${where}: contains "${literal}". The operator is a natural person and has no ОГРНИП.`,
      );
    }
  }
  if (AFFIRMATIVE_ENTREPRENEUR.test(text)) {
    throw new Error(
      `${where}: describes the operator as an individual entrepreneur. ` +
        'The operator is a natural person who is not registered as one.',
    );
  }
  if (IP_ABBREVIATION.test(text)) {
    throw new Error(`${where}: uses the abbreviation "ИП" as a designation.`);
  }
  if (PUBLISHED_TAX_IDENTIFIER.test(text)) {
    throw new Error(
      `${where}: publishes a tax identifier. 152-FZ requires the operator's name and ` +
        'an address for requests, not an ИНН; keep it in private configuration ' +
        '(operatorPrivateConfig) unless counsel confirms it must be published.',
    );
  }
}
