/**
 * Canonical registry of the consent wording shown in the product.
 *
 * Displaying a consent notice and keeping no evidence of it is not a record. Every
 * form that shows one of these notices must persist a `ConsentRecord` referencing
 * the exact `id` + `version` below, so that months later it is possible to answer
 * "what precisely did this person agree to, and when?".
 *
 * Rules for changing wording:
 *  - NEVER edit the `text` of an existing entry in place. Add a new version.
 *  - Old versions must stay in `CONSENT_TEXT_ARCHIVE` forever, because previously
 *    stored records point at them.
 *  - Bump `CONSENT_POLICY_VERSION` whenever the privacy policy itself materially
 *    changes, and add a matching consent-text version.
 *  - The operator is named from `operator.ts`. Never inline a name or an ИНН here.
 */

import {
  OPERATOR_CONTACT_EMAIL,
  OPERATOR_FULL_NAME_DATIVE,
  OPERATOR_FULL_NAME_GENITIVE,
  assertOperatorDesignation,
} from './operator';

/** Version of the published privacy policy that the current notices refer to. */
export const CONSENT_POLICY_VERSION = '2026-08-10.1';

export type ConsentSubjectId = 'cash-os-lead-form' | 'cash-os-lead-marketing';

/**
 * `required` notices block the submission they belong to. `optional` notices are
 * recorded separately and must never gate anything — mixing the two is precisely
 * the defect that makes a marketing consent unusable as evidence.
 *
 * `notice` is neither: nothing is ticked and nothing is blocked. It is a passive
 * statement displayed at the point of submission, and the record of it says only
 * "this wording was on the page when this lead was sent" — never that the person
 * performed an affirmative act. Storing one as `required` would be manufacturing
 * an acknowledgement that did not happen, which is the whole reason the three are
 * distinguished here rather than at the call site.
 */
export type ConsentObligation = 'required' | 'optional' | 'notice';

export interface ConsentTextEntry {
  id: ConsentSubjectId;
  version: string;
  locale: string;
  /** The exact sentence rendered to the user, excluding link markup. */
  text: string;
  /** Privacy-policy version this wording points at. */
  policyVersion: string;
  obligation: ConsentObligation;
}

/**
 * Phrases inside the required wording that are rendered as links.
 *
 * The UI splits the registry text on these exact substrings, so the sentence the
 * user reads is character-for-character the sentence that is stored as evidence.
 * Changing a phrase here without changing the text below breaks a build-time
 * assertion rather than silently unlinking the reference.
 */
export const CONSENT_LINK_PHRASES = Object.freeze({
  consentDocument: 'Согласием на обработку персональных данных',
  privacyPolicy: 'Политикой обработки персональных данных',
});

/** Route of the standalone consent document. */
export const CONSENT_DOCUMENT_PATH = '/consent';
/** Route of the privacy policy. */
export const PRIVACY_POLICY_PATH = '/privacy';

/* ------------------------------------------------------------------------- */
/* Wording                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * The wording actually deployed on liqvia.info before this framework existed.
 *
 * Transcribed verbatim from the served HTML on 2026-08-10 — an archived wording
 * that paraphrases what the user really saw is not evidence of anything. It
 * identified no operator, named a «Политика конфиденциальности» that was not
 * reachable on the marketing host, and was not accompanied by any stored record.
 *
 * Kept registered so that a browser still holding the old bundle can deliver its
 * lead against the version it genuinely displayed. Superseded 2026-08-10.
 */
const CASH_OS_LEAD_FORM_CONSENT_TEXT_V1 =
  'Отправляя форму, вы соглашаетесь с обработкой персональных данных в соответствии с ' +
  'Политикой конфиденциальности. Мы используем ваши данные только для связи по вашей ' +
  'заявке и не передаём их третьим лицам без вашего согласия.';

/**
 * Required consent, shown immediately before the submit button.
 *
 * Names the operator, states the purposes, and points at the two documents that
 * describe the processing in full.
 *
 * The operator is identified by name only. An earlier draft of this version also
 * quoted the ИНН; it was removed before the wording was ever displayed to anyone
 * (see the note on `2026-08-10.1` in `buildArchive`), so no stored record refers
 * to a wording containing it. See `operator.ts` for why.
 */
export const CASH_OS_LEAD_FORM_CONSENT_TEXT =
  `Я даю ${OPERATOR_FULL_NAME_DATIVE} согласие на обработку моих ` +
  'персональных данных, указанных в форме, с целью рассмотрения моего обращения, связи ' +
  'со мной, организации и проведения консультации в соответствии с отдельным ' +
  `${CONSENT_LINK_PHRASES.consentDocument}. Я ознакомлен(а) с ` +
  `${CONSENT_LINK_PHRASES.privacyPolicy}.`;

/**
 * Passive notice shown immediately below the submit button.
 *
 * This is what the lead form actually displays. The affirmative checkbox above
 * (`2026-08-10.1`) stays registered but is not rendered: it asked the visitor to
 * confirm they had read `/consent` and `/privacy`, and those two documents are
 * still drafts that render «НЕ УСТАНОВЛЕНО» markers behind a "not in force"
 * banner. Asking someone to tick "I have read this" against an unfinished
 * document produces evidence of something that cannot be true, which is worse
 * than the passive notice it replaced.
 *
 * So the wording names no document and asks for no act. It states the purpose —
 * handling the enquiry the visitor is sending — and nothing wider, because the
 * purpose is the one part of the notice that must hold without the documents.
 *
 * The V1 wording above is the site's own earlier passive notice and was the
 * obvious thing to restore, but it points at a «Политика конфиденциальности»
 * that is exactly one of the drafts, and adds a third-party-transfer promise
 * that belongs in a policy rather than in a one-line notice. Hence a new
 * version rather than a revival of that one.
 *
 * Registered as a `notice`, so the server can store what was displayed without
 * any code path being able to mistake it for a tick.
 */
export const CASH_OS_LEAD_FORM_NOTICE_TEXT =
  'Нажимая кнопку, вы соглашаетесь на обработку персональных данных ' +
  'в целях обработки вашего обращения.';

/** Subject the passive lead-form notice is recorded under. */
export const LEAD_NOTICE_SUBJECT: ConsentSubjectId = 'cash-os-lead-form';
/** Version of the passive notice this build renders. */
export const LEAD_NOTICE_VERSION = '2026-08-10.2';

/**
 * Optional marketing consent.
 *
 * Built from the verified contact address rather than stored as a literal,
 * because the wording promises an opt-out channel: registering it with a
 * placeholder would publish a promise nobody can act on. While
 * `OPERATOR_CONTACT_EMAIL` is `null` this returns `null`, the notice is absent
 * from the registry, the checkbox is not rendered, and the server rejects any
 * marketing consent submitted by a stale client.
 *
 * Once a version of this wording has shipped, never change the address inside
 * it — add a new version, as with every other notice.
 */
export function buildMarketingConsentText(email: string | null): string | null {
  if (!email?.trim()) return null;
  return (
    'Я отдельно соглашаюсь получать информационные и рекламные сообщения от ' +
    `${OPERATOR_FULL_NAME_GENITIVE} по указанным мной контактным ` +
    'данным. Я могу отказаться от сообщений в любое время, направив обращение по адресу ' +
    `${email.trim()}.`
  );
}

export const CASH_OS_LEAD_MARKETING_CONSENT_TEXT: string | null =
  buildMarketingConsentText(OPERATOR_CONTACT_EMAIL);

/**
 * Whether the optional marketing checkbox may be shown at all.
 *
 * Two conditions, both necessary: an opt-out address exists, and promotional
 * messages are actually sent. The second is a business fact, not a technical
 * one — asking for consent to something that never happens is its own defect —
 * so it is an explicit constant rather than an inference.
 */
const PROMOTIONAL_MESSAGES_ARE_SENT: boolean = false;

export const MARKETING_CONSENT_ENABLED: boolean =
  PROMOTIONAL_MESSAGES_ARE_SENT && CASH_OS_LEAD_MARKETING_CONSENT_TEXT !== null;

/** Shown when the required box is not ticked. Russian, because the form is Russian. */
export const CONSENT_REQUIRED_MESSAGE_RU =
  'Чтобы отправить заявку, необходимо дать согласие на обработку персональных данных.';

/* ------------------------------------------------------------------------- */
/* Registry                                                                   */
/* ------------------------------------------------------------------------- */

function registerEntry(e: ConsentTextEntry): ConsentTextEntry {
  assertOperatorDesignation(e.text, `consent notice ${e.id}@${e.version}`);
  return Object.freeze(e);
}

function buildArchive(): Record<string, ConsentTextEntry> {
  const entries: ConsentTextEntry[] = [
    registerEntry({
      id: 'cash-os-lead-form',
      version: '2026-08-09.1',
      locale: 'ru',
      text: CASH_OS_LEAD_FORM_CONSENT_TEXT_V1,
      policyVersion: '2026-08-09.1',
      obligation: 'required',
    }),
    // The wording of 2026-08-10.1 was amended in place on 2026-08-10 (the ИНН was
    // dropped) rather than superseded by a 2026-08-10.2. That is normally
    // forbidden by the rules at the top of this file, and is permissible here for
    // one reason only: this version had never been displayed to anyone, so no
    // record can point at the earlier wording. Verified against production on
    // 2026-08-10 — the ConsentRecord table did not exist there, and the wording
    // served by liqvia.info was V1 above. Evidence: docs/RU_CURRENT_LEAD_DATA_FLOW.md.
    // Once this version ships, the append-only rule applies again without exception.
    registerEntry({
      id: 'cash-os-lead-form',
      version: '2026-08-10.1',
      locale: 'ru',
      text: CASH_OS_LEAD_FORM_CONSENT_TEXT,
      policyVersion: CONSENT_POLICY_VERSION,
      obligation: 'required',
    }),
    // The wording the form displays today. It supersedes 2026-08-10.1 on the page
    // but not in the archive: a browser still holding the previous bundle posts a
    // genuine tick against that version, and the server must keep accepting it.
    registerEntry({
      id: LEAD_NOTICE_SUBJECT,
      version: LEAD_NOTICE_VERSION,
      locale: 'ru',
      text: CASH_OS_LEAD_FORM_NOTICE_TEXT,
      policyVersion: CONSENT_POLICY_VERSION,
      obligation: 'notice',
    }),
  ];

  // Registered only when marketing consent is genuinely enabled — not merely when
  // an opt-out address exists. A verified operator mailbox is supplied for subject
  // requests and consent withdrawal; it is not a decision to start marketing. While
  // this stays unregistered the server rejects any marketing consent outright,
  // rather than relying on a single downstream flag to drop it.
  if (MARKETING_CONSENT_ENABLED && CASH_OS_LEAD_MARKETING_CONSENT_TEXT) {
    entries.push(
      registerEntry({
        id: 'cash-os-lead-marketing',
        version: '2026-08-10.1',
        locale: 'ru',
        text: CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
        policyVersion: CONSENT_POLICY_VERSION,
        obligation: 'optional',
      }),
    );
  }

  return Object.fromEntries(entries.map((e) => [consentKey(e.id, e.version), e]));
}

/** Every consent wording ever shown, keyed by `${id}@${version}`. Append-only. */
export const CONSENT_TEXT_ARCHIVE: Readonly<Record<string, ConsentTextEntry>> = Object.freeze(
  buildArchive(),
);

/**
 * The version currently in use for each *affirmative* consent subject.
 *
 * Not the same thing as "what the lead form shows": the form shows
 * `LEAD_NOTICE_VERSION`, a passive notice. This map covers the versions a client
 * may submit as an acknowledgement, and the lead-form entry is kept here so a
 * stale bundle's genuine tick is still recognised as the current wording.
 */
export const ACTIVE_CONSENT_VERSION: Readonly<Record<ConsentSubjectId, string>> = Object.freeze({
  'cash-os-lead-form': '2026-08-10.1',
  'cash-os-lead-marketing': '2026-08-10.1',
});

/** The notice that must be acknowledged before a landing-page lead is accepted. */
export const REQUIRED_LEAD_CONSENT_SUBJECT: ConsentSubjectId = 'cash-os-lead-form';
/** The notice recorded separately when the optional marketing box is ticked. */
export const MARKETING_LEAD_CONSENT_SUBJECT: ConsentSubjectId = 'cash-os-lead-marketing';

export function consentKey(id: string, version: string): string {
  return `${id}@${version}`;
}

export function lookupConsentText(id: string, version: string): ConsentTextEntry | undefined {
  return CONSENT_TEXT_ARCHIVE[consentKey(id, version)];
}

export function activeConsentEntry(id: ConsentSubjectId): ConsentTextEntry {
  const entry = lookupConsentText(id, ACTIVE_CONSENT_VERSION[id]);
  if (!entry) {
    throw new Error(`No consent text registered for ${id}@${ACTIVE_CONSENT_VERSION[id]}`);
  }
  return entry;
}

/**
 * Splits a registered wording into plain segments and link segments.
 *
 * The concatenation of every returned `text` equals the input exactly, which is
 * what lets the UI render links inside the sentence while still sending the
 * unmodified registry string as evidence.
 */
export interface ConsentTextSegment {
  text: string;
  href?: string;
}

export function segmentConsentText(
  text: string,
  links: ReadonlyArray<{ phrase: string; href: string }>,
): ConsentTextSegment[] {
  let segments: ConsentTextSegment[] = [{ text }];

  for (const { phrase, href } of links) {
    const next: ConsentTextSegment[] = [];
    let matched = false;

    for (const segment of segments) {
      if (segment.href || matched) {
        next.push(segment);
        continue;
      }
      const at = segment.text.indexOf(phrase);
      if (at === -1) {
        next.push(segment);
        continue;
      }
      matched = true;
      const before = segment.text.slice(0, at);
      const after = segment.text.slice(at + phrase.length);
      if (before) next.push({ text: before });
      next.push({ text: phrase, href });
      if (after) next.push({ text: after });
    }

    if (!matched) {
      throw new Error(`Consent wording does not contain the linked phrase "${phrase}"`);
    }
    segments = next;
  }

  return segments;
}
