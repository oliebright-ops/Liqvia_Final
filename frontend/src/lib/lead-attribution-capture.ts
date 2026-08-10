/**
 * Captures paid-traffic attribution in the browser, and keeps it for the length
 * of the visit.
 *
 * Reading `location.search` at the moment the form is submitted would be the
 * obvious implementation and it would lose attribution routinely. The landing
 * page links out to `/privacy` and `/consent` — the privacy notice under the
 * submit button exists to be read — and a visitor who follows one and comes back
 * arrives on a URL with no query string at all. The `?utm_campaign=…` that paid
 * for them is gone, and the lead records as organic.
 *
 * So the parameters are read once, on arrival, and held in `sessionStorage`.
 *
 * **First touch wins.** Once a visit has attribution, a later pageview cannot
 * overwrite it. This matters for the same reason: the visitor who returns from
 * `/privacy` would otherwise overwrite a real campaign with nothing. It also
 * means a single visit reports the advert that actually brought the person here,
 * rather than whichever page they happened to be on when they finally submitted.
 *
 * `sessionStorage`, not `localStorage`, and not a cookie:
 *   - it is scoped to the tab and cleared when the visit ends, so it cannot
 *     attribute next month's lead to last month's campaign;
 *   - it is never transmitted automatically the way a cookie is;
 *   - it holds campaign metadata only — nothing the visitor typed goes into it.
 */
import {
  normaliseLeadAttribution,
  parseLeadAttribution,
  type LeadAttribution,
} from '@liqvia2/shared';

const STORAGE_KEY = 'liqvia.lead.attribution';

/** Storage can be absent or throw (private mode, disabled, quota). Never fatal. */
function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the current URL's attribution and records it if this visit has none yet.
 *
 * Safe to call on every mount: it is idempotent within a visit.
 */
export function captureLeadAttribution(): void {
  if (typeof window === 'undefined') return;

  const fromUrl = parseLeadAttribution(window.location.search);
  if (Object.keys(fromUrl).length === 0) return;

  const storage = safeSessionStorage();
  if (!storage) return;

  try {
    // First touch wins — see the note above.
    if (storage.getItem(STORAGE_KEY)) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
  } catch {
    // A full or unavailable store must never break the form. Losing attribution
    // is a reporting gap; losing the lead is a lost customer.
  }
}

/**
 * The attribution to send with a submission.
 *
 * Falls back to the live URL when nothing was stored, so the capture still works
 * if `sessionStorage` is unavailable and the visitor never left the page.
 */
export function readLeadAttribution(): LeadAttribution {
  if (typeof window === 'undefined') return {};

  const storage = safeSessionStorage();
  if (storage) {
    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        // Re-validate rather than trusting the store: it is editable by anyone
        // with the console open. The stored shape is already field-keyed, which
        // is what normaliseLeadAttribution takes.
        const attribution = normaliseLeadAttribution(JSON.parse(stored));
        if (Object.keys(attribution).length > 0) return attribution;
      }
    } catch {
      // Corrupt JSON: fall through to the URL.
    }
  }

  return parseLeadAttribution(window.location.search);
}
