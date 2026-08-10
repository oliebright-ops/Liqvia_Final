/**
 * Paid-traffic attribution for landing-page leads.
 *
 * Until now every lead carried the same hard-coded `source` literal, so the
 * question "which campaign paid for this lead?" had no answer at all. Yandex
 * Direct spend cannot be judged without one.
 *
 * The rules live here, in shared code, because the browser and the server must
 * agree on them exactly: the browser decides what to *capture*, the server
 * decides what to *store*, and if those two disagree the difference is silent —
 * a value that looks captured but is quietly dropped, or worse, one the server
 * accepts that the browser would never have sent. The server re-applies every
 * rule regardless of what arrives, because a query string is attacker-controlled
 * and `/?utm_campaign=<5MB>` is a free write to an unbounded text column.
 *
 * ## Why named parameters and not the whole URL
 *
 * `CashOsLead.source` has always carried a promise, asserted in
 * `ru-lead-boundary.spec.ts`: nothing from the address bar is stored wholesale.
 * That promise is worth keeping — a landing URL can accumulate arbitrary
 * third-party parameters, and a visitor who arrives via a link someone else
 * built may carry anything in it. So this module never stores a URL. It reads
 * six known parameters by name, sanitises each, and discards everything else,
 * including any parameter it does not recognise.
 *
 * ## On `yclid`
 *
 * Yandex's click identifier. It identifies an ad click, not a person, and it
 * stays inside the RU data plane — nothing in this codebase sends it back to
 * Yandex. Storing it is what would make offline-conversion reporting *possible*
 * later; that is a separate processing purpose and a separate decision, and it
 * is not taken here. It is also the one attribution value cleared on erasure,
 * because Yandex holds the other half of the mapping (see LeadRetentionService).
 */

/** The attribution fields, named as they are stored. */
export const LEAD_ATTRIBUTION_FIELDS = [
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'yclid',
] as const;

export type LeadAttributionField = (typeof LEAD_ATTRIBUTION_FIELDS)[number];

/** Captured attribution. Every field is optional: organic traffic has none. */
export type LeadAttribution = Partial<Record<LeadAttributionField, string>>;

/** Which query parameter each field is read from. */
export const LEAD_ATTRIBUTION_QUERY_PARAM: Record<LeadAttributionField, string> = {
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmContent: 'utm_content',
  utmTerm: 'utm_term',
  yclid: 'yclid',
};

/**
 * Length ceilings, applied by truncation rather than rejection.
 *
 * Truncating is right here where rejecting is right for the lead's own fields:
 * an over-long campaign name is a tagging mistake, and losing the lead — or
 * losing all of its attribution — over one would be a far worse outcome than
 * storing a clipped campaign name. `utmTerm` is the most generous because it
 * holds a matched search phrase, which is genuinely the longest of these in
 * ordinary use.
 */
export const MAX_ATTRIBUTION_LENGTH: Record<LeadAttributionField, number> = {
  utmSource: 100,
  utmMedium: 100,
  utmCampaign: 200,
  utmContent: 200,
  utmTerm: 400,
  yclid: 64,
};

/**
 * A yclid is Yandex-generated and always of this shape. Anything else in the
 * parameter was not produced by Yandex, so it is dropped rather than stored:
 * unlike a campaign name, there is no such thing as a legitimately unusual one.
 */
const YCLID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Control characters, including the NUL that PostgreSQL rejects outright. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

/**
 * Cleans one value, or returns undefined when nothing usable remains.
 *
 * Deliberately permissive about the alphabet for the UTM fields: Yandex
 * substitutes real campaign names and real matched keywords into them, and both
 * are routinely Cyrillic. Restricting to ASCII would silently drop attribution
 * on exactly the campaigns this is being built for.
 */
export function sanitiseAttributionValue(
  field: LeadAttributionField,
  raw: unknown,
): string | undefined {
  if (typeof raw !== 'string') return undefined;

  const cleaned = raw.replace(CONTROL_CHARACTERS, '').trim();
  if (!cleaned) return undefined;

  const value = cleaned.slice(0, MAX_ATTRIBUTION_LENGTH[field]);

  // Yandex leaves the template unsubstituted when a campaign is misconfigured.
  // Storing "{campaign_name}" would look like real attribution in a report and
  // quietly corrupt it, so treat it as absent.
  if (value.startsWith('{') && value.endsWith('}')) return undefined;

  if (field === 'yclid' && !YCLID_PATTERN.test(value)) return undefined;

  return value;
}

/**
 * Reads attribution out of a URL query string.
 *
 * Accepts the raw `location.search` (with or without the leading `?`). Unknown
 * parameters are ignored entirely — they are never collected, so they can never
 * be stored.
 */
export function parseLeadAttribution(search: string): LeadAttribution {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  // Lower-cased lookup: Yandex emits lower-case names, but a hand-built link may
  // not, and losing attribution to a capital letter would be a silly way to lose it.
  const lowered = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    const name = key.toLowerCase();
    if (!lowered.has(name)) lowered.set(name, value);
  }

  const result: LeadAttribution = {};
  for (const field of LEAD_ATTRIBUTION_FIELDS) {
    const value = sanitiseAttributionValue(
      field,
      lowered.get(LEAD_ATTRIBUTION_QUERY_PARAM[field]),
    );
    if (value !== undefined) result[field] = value;
  }
  return result;
}

/**
 * Re-applies every rule to whatever a client actually sent.
 *
 * The server never trusts the browser's sanitisation — anything can POST to the
 * lead endpoint. Structurally invalid input yields empty attribution rather than
 * an error: attribution is metadata about an advert, and a malformed campaign
 * tag must never be the reason a real person's enquiry is rejected.
 */
export function normaliseLeadAttribution(input: unknown): LeadAttribution {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const source = input as Record<string, unknown>;
  const result: LeadAttribution = {};
  for (const field of LEAD_ATTRIBUTION_FIELDS) {
    const value = sanitiseAttributionValue(field, source[field]);
    if (value !== undefined) result[field] = value;
  }
  return result;
}

/** True when nothing at all was captured, i.e. the visit was not tagged. */
export function isAttributionEmpty(attribution: LeadAttribution): boolean {
  return LEAD_ATTRIBUTION_FIELDS.every((field) => attribution[field] === undefined);
}

/**
 * A short human-readable summary, for an operator notification.
 *
 * Contains campaign metadata only and never any field the visitor typed, so it
 * is safe to put in a message that leaves the RU plane.
 */
export function describeAttribution(attribution: LeadAttribution): string {
  if (isAttributionEmpty(attribution)) return 'без меток (прямой или органический переход)';

  const parts: string[] = [];
  if (attribution.utmSource) parts.push(`источник: ${attribution.utmSource}`);
  if (attribution.utmMedium) parts.push(`канал: ${attribution.utmMedium}`);
  if (attribution.utmCampaign) parts.push(`кампания: ${attribution.utmCampaign}`);
  if (attribution.utmContent) parts.push(`объявление: ${attribution.utmContent}`);
  if (attribution.utmTerm) parts.push(`запрос: ${attribution.utmTerm}`);
  if (attribution.yclid) parts.push('yclid: есть');
  return parts.join(' · ');
}
