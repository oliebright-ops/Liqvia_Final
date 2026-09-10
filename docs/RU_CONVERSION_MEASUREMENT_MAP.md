# RU conversion measurement map

What is measured at each step from a paid click to a customer, where the number
lives, and — the part that matters most here — **which steps are not measured at
all**.

Verified against production on **10 September 2026**.

## The chain

| # | Step | Measured by | Where it lives | Status |
|---|---|---|---|---|
| 1 | Paid click | Direct click counter | Yandex Direct | ✅ automatic |
| 2 | Landing session | Metrica visit, counter `111417446` | Metrica | ✅ automatic |
| 3 | Attribution captured | 6 fields into `sessionStorage` | browser, first-touch | ✅ verified |
| 4 | Form start | goal `form_start` (`594566833`) | Metrica | ✅ verified — fires once, on first keystroke |
| 5 | **Successful submission** | goal `form_submit` (`594566783`) | Metrica | ✅ verified — fires **only** after HTTP 201 |
| 6 | Delivered lead | row in `CashOsLead` + `ConsentRecord` | RU Postgres | ✅ implied by the 201 |
| 7 | Owner notified | email + Telegram | inbox | ✅ confirmed received |
| 8 | Qualified lead | — | — | ❌ **not measured** |
| 9 | Booked call | — | — | ❌ **not measured** |
| 10 | Customer | — | — | ❌ **not measured** |

## Steps 1–6 are sound

Verified by submitting a labelled test lead through the real form on production:

- `POST /api/cash-os-leads` → **201**
- `form_submit` fired **exactly once**
- on a forced 503, `form_submit` fired **zero** times
- all six attribution fields captured, including a Cyrillic `utm_term` and `yclid`

**Step 6 needs no separate probe.** `CashOsLeadsService.create` returns
`{status:'ok'}` only after `writeLead`'s transaction commits; a failed write
throws `ServiceUnavailableException` → 503. So a `201` *is* the proof that the
row and its consent evidence were committed to the RU database. There is no state
in which the browser sees success and the database has nothing.

## Step 7 works, but is not observable

**Confirmed by the owner on 10 September 2026:** the «Новая заявка Liqvia — …»
notification for the labelled test lead arrived. The delivery path is proven
working end to end, which — with steps 1–6 — means **the entire chain from paid
click to a lead in the owner's hands is verified.**

What remains true is that this path cannot report its own failure. Notifications
are dispatched **un-awaited**, deliberately, so the visitor is not made to watch a
spinner while an SMTP handshake completes; the database row, not the message, is
the record of the lead. And `nest-app.ts` sets `logger: ['error','warn']` in the
embedded production server, so a *successful* send logs nothing at all.

So: delivery is proven, but **monitoring of delivery is not**. A future failure
would be silent, and the first sign of it would be an absence — no alert, just no
notification for a lead that is sitting in the database. If alerts ever go quiet
while `form_submit` is firing, check `LEAD_NOTIFY_TELEGRAM_IPS` first: Telegram
rotates addresses and the RU host's egress is partially filtered, so a pinned
address going stale is the most likely cause.

Note the asymmetry that makes this tolerable rather than urgent: a lost
*notification* is a delayed lead, because the row is still in the database and
can be read. A lost *lead* would be unrecoverable. The design puts the fragile
part on the recoverable side, which is the right way round.

## Steps 8–10 do not exist

Nothing downstream of "a lead arrived" is recorded anywhere. There is no CRM, no
qualification flag, no call outcome, and no link from a customer back to the
`yclid` that paid for them.

**This is the reason the campaign cannot currently be optimised, and it is not a
tracking bug — it is a missing system.** Direct can only optimise toward what it
is told about. Today the best signal available to it is `form_submit`, which so
far has never fired ([[ru-direct-zero-real-leads]]: 0 in 20 days).

### What offline conversions would need

Yandex offline-conversion upload maps a stored `yclid` to a real commercial
outcome, which is what would let Direct optimise toward *revenue* instead of
toward form fills. The prerequisites, in order:

1. **A place to record lead outcome** — qualified / not, call booked, won. Even a
   spreadsheet keyed by lead id would do to start.
2. **`yclid` retained against the lead.** Already implemented and verified.
3. **A decision that this is a lawful processing purpose.** Deliberately *not*
   taken in code: `packages/shared/src/lead-attribution.ts` stores `yclid` for
   attribution only and explicitly notes that sending it back to Yandex is "a
   separate processing purpose and a separate decision, and it is not taken
   here." It also remains the one attribution value cleared on erasure, because
   Yandex holds the other half of the mapping.

Step 3 is a business and legal decision, not an engineering task. Do not wire up
offline conversions without taking it explicitly.

## Goal hygiene

The four Metrica goals are **not** equivalent, and Direct's default reporting
bundles them:

| Goal | Id | Meaning |
|---|---|---|
| `form_submit` | `594566783` | **The only real lead.** |
| `form_start` | `594566833` | Engagement. Someone typed one character. |
| `faq_click` | `594566856` | Engagement. |
| `deep_scroll_90` | `594566857` | Engagement. Scrolled 90% of the page. |

Bundled, these reported a 13% conversion rate. Filtered to `form_submit` alone,
the campaign has produced **zero** leads.

**Always filter reports to `goalIds=594566783` before drawing any conclusion.**

A note for future changes: `data-cta-event="form_submit"` attributes exist in the
markup for click-map purposes and are read by nothing. Goals fire only through
`trackCtaEvent`, and `form_submit` is called at exactly one place —
`lead-form.tsx`, after `await apiPost` resolves. Keep it that way: moving it to a
click handler would turn every abandoned form into a phantom lead and destroy the
one trustworthy number in this table.
