import type { CounterpartyRegistry } from './pseudonymise';

/**
 * Sanitisation for the one payload field that cannot be allowlisted: free text the
 * user typed.
 *
 * A finance question is not a safe category of text. "Can I pay Ivan Petrov's
 * invoice — ivan@acme.ru, account 40702810900000012345 — before payroll?" is an
 * ordinary thing for a founder to type. Everything here assumes that.
 *
 * Two passes:
 *  1. Counterparty names known to Liqvia are swapped for their pseudonymous codes.
 *     This *keeps* the question answerable — the model still knows which receivable
 *     is being asked about — while removing the identity.
 *  2. Structural identifiers (emails, phones, IBANs, card and account numbers, tax
 *     ids) are replaced with type-labelled placeholders.
 *
 * Anything not recognised still passes through. This is a reduction of risk, not a
 * proof of safety, which is why the gateway also caps length and why the system
 * prompt instructs the model to ignore identifiers.
 */

export const REDACTION_PLACEHOLDERS = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  iban: '[BANK_ACCOUNT]',
  card: '[CARD_NUMBER]',
  account: '[BANK_ACCOUNT]',
  taxId: '[TAX_ID]',
  url: '[URL]',
} as const;

/** Longest question we will forward. Beyond this it is not a question, it is a paste. */
export const MAX_FREE_TEXT_LENGTH = 1000;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[A-Z0-9]{1,4}\b/g;
/** RU settlement/correspondent accounts are exactly 20 digits. */
const RU_ACCOUNT_RE = /\b\d{20}\b/g;
/** Card numbers: 13–19 digits, optionally grouped in fours. */
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
/** RU INN (10 or 12) / OGRN (13 or 15) / SNILS. Matched before the generic rule. */
const RU_TAX_ID_RE = /\b(?:\d{10}|\d{12}|\d{13}|\d{15})\b/g;
/** International-ish phone numbers. Requires either a leading + or 10+ digits. */
const PHONE_RE = /(?:\+\d{1,3}[\s.()-]*)?(?:\d[\s.()-]?){8,13}\d/g;

export interface RedactionResult {
  text: string;
  /** What was removed, by type. Useful for telemetry and for tests; contains no values. */
  removed: Record<string, number>;
  truncated: boolean;
}

/**
 * @param registry when supplied, known counterparty names are replaced by their
 *   pseudonymous codes before structural redaction runs.
 */
export function redactFreeText(
  input: string | null | undefined,
  registry?: CounterpartyRegistry,
): RedactionResult {
  const removed: Record<string, number> = {};
  const bump = (kind: string) => {
    removed[kind] = (removed[kind] ?? 0) + 1;
  };

  if (!input) return { text: '', removed, truncated: false };

  const truncated = input.length > MAX_FREE_TEXT_LENGTH;
  let text = truncated ? input.slice(0, MAX_FREE_TEXT_LENGTH) : input;

  // Pass 1 — swap known identities for codes, longest name first so that
  // "Acme Trading Ltd" is not half-replaced by a match on "Acme".
  if (registry) {
    for (const { name, code } of registry.namesForScrubbing()) {
      if (name.length < 3) continue; // too short to match safely
      const pattern = new RegExp(escapeRegExp(name), 'gi');
      text = text.replace(pattern, () => {
        bump('counterpartyName');
        return code;
      });
    }
  }

  // Pass 2 — structural identifiers. Order matters: the most specific patterns
  // must consume their digits before the generic phone rule sees them.
  text = text
    .replace(EMAIL_RE, () => (bump('email'), REDACTION_PLACEHOLDERS.email))
    .replace(URL_RE, () => (bump('url'), REDACTION_PLACEHOLDERS.url))
    .replace(IBAN_RE, () => (bump('iban'), REDACTION_PLACEHOLDERS.iban))
    .replace(RU_ACCOUNT_RE, () => (bump('account'), REDACTION_PLACEHOLDERS.account))
    .replace(CARD_RE, (m) => (countDigits(m) >= 13 ? (bump('card'), REDACTION_PLACEHOLDERS.card) : m))
    .replace(RU_TAX_ID_RE, () => (bump('taxId'), REDACTION_PLACEHOLDERS.taxId))
    .replace(PHONE_RE, (m) => (countDigits(m) >= 9 ? (bump('phone'), REDACTION_PLACEHOLDERS.phone) : m));

  return { text: text.trim(), removed, truncated };
}

/**
 * Strict sanitiser for short labels that originate from user-supplied data but are
 * still useful to the model — budget category names, data-quality warning codes.
 *
 * Unlike `redactFreeText` this also caps length hard, because a label is not a
 * place to smuggle a paragraph.
 */
export function safeLabel(input: string | null | undefined, maxLength = 60): string {
  if (!input) return '';
  const { text } = redactFreeText(input.slice(0, maxLength * 2));
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function countDigits(value: string): number {
  let n = 0;
  for (const ch of value) if (ch >= '0' && ch <= '9') n += 1;
  return n;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
