/**
 * Redaction helpers for anything that reaches a log sink.
 *
 * Application logs are shipped to the hosting provider and retained there under
 * that provider's policy, outside Liqvia's control. Treat them as a place where
 * personal data must not appear at all, rather than a place where it is merely
 * inconvenient.
 *
 * These helpers keep enough shape for an operator to correlate an incident
 * (domain, length, prefix character) without carrying the identity itself.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
/** Long digit runs: card numbers, RU 20-digit account numbers, INN/OGRN. */
const LONG_DIGITS_RE = /\b\d{9,}\b/g;
/** Digit groups separated by spaces or dashes, e.g. "4111 1111 1111 1111". */
const GROUPED_DIGITS_RE = /\b(?:\d[ -]?){12,}\d\b/g;
const PHONE_RE = /(?:\+\d{1,3}[\s(-]*)?(?:\d[\s()-]?){9,14}\d/g;

/**
 * Masks an email to `a***@example.com`.
 *
 * The domain is kept because it is operationally useful (which tenant / which mail
 * provider) and is not by itself identifying; the local part is not.
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return '[no-email]';
  const at = value.lastIndexOf('@');
  if (at <= 0) return '[redacted]';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = local[0] ?? '';
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/**
 * Strips identifiers from an arbitrary string before it is logged.
 *
 * Used on strings whose contents are not fully under our control — most
 * importantly third-party error messages, which may embed request payload
 * fragments.
 */
export function redactForLog(value: string): string {
  return value
    .replace(EMAIL_RE, (m) => maskEmail(m))
    .replace(IBAN_RE, '[account-redacted]')
    .replace(GROUPED_DIGITS_RE, '[number-redacted]')
    .replace(PHONE_RE, (m) => (countDigits(m) >= 9 ? '[number-redacted]' : m))
    .replace(LONG_DIGITS_RE, '[number-redacted]');
}

/**
 * Reduces an unknown thrown value to a short, safe log string.
 *
 * `String(err)` on a third-party error can carry request/response fragments; this
 * keeps the error name and a redacted, truncated message and drops the stack.
 */
export function describeErrorForLog(err: unknown, maxLength = 200): string {
  if (err instanceof Error) {
    const message = redactForLog(err.message).slice(0, maxLength);
    return `${err.name}: ${message}`;
  }
  if (typeof err === 'string') return redactForLog(err).slice(0, maxLength);
  return '[non-error thrown]';
}

function countDigits(value: string): number {
  let n = 0;
  for (const ch of value) if (ch >= '0' && ch <= '9') n += 1;
  return n;
}
