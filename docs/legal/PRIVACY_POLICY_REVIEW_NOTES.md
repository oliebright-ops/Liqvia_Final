# Privacy notice — published state and what still needs counsel

**Page:** `frontend/src/app/privacy/page.tsx`
**Route:** `/privacy`
**Version constant:** `CONSENT_POLICY_VERSION` in `packages/shared/src/consent.ts`
**Current state:** **published**. Indexed, no draft banner, no placeholders.

## What changed on 2026-08-10

The page was a draft: a "not published and not in force" banner, `noindex, nofollow`, and sixteen
«НЕ УСТАНОВЛЕНО» markers. It also described the authenticated product and its Render hosting —
neither of which is reachable from `liqvia.info` nor receives any data submitted there.

It was replaced with an **interim notice scoped to what the public site actually does**: the lead
form and the Metrica counter. Every statement in it is verified against the running system or the
source that produces it.

**Unestablished facts are omitted, not placeholdered.** A placeholder on a public page publishes
the statement that the operator does not know what it does with personal data. The notice therefore
says nothing about the physical storage region of database backups (U3), Metrica console retention
and access settings, or any processor outside the lead flow — because it makes no claim that
depends on them.

The page no longer consults `isLegalPublicationReady()`. That gate guards documents which assert the
facts it tracks; this one asserts none of them. **The gate itself is unchanged and `/consent` still
uses it.**

## Policy version amended in place — a spent exception

`CONSENT_POLICY_VERSION` stayed at `2026-08-10.1` while the text under it was rewritten.

The reason is mechanical. In `buildArchive()`, every registered entry takes `policyVersion:
CONSENT_POLICY_VERSION` — the constant, not a literal. Bumping it would silently rewrite the policy
version of consent wordings already registered and already referenced by stored records, which is
exactly what the append-only rule forbids.

Four `ConsentRecord` rows in the RU database carry `policyVersion = 2026-08-10.1`. All four are
`checkbox` records created on 2026-08-09 during the historical-lead migration and the restore probe;
none was written by a visitor acting on this page. The superseded policy text is preserved in Git at
commit `4d917c3`.

**This exception is now spent.** Before the next material change to `/privacy`:

1. give each archive entry a literal `policyVersion` instead of the shared constant, so a bump
   cannot reach backwards;
2. then bump `CONSENT_POLICY_VERSION` and add a matching consent-text version.

## `/consent` is still a draft, and is no longer linked

`/consent` describes the affirmative checkbox consent. The form does not show a checkbox — it shows
a passive notice (`method = passive-notice`) — so that document governs nothing a visitor does, and
it still renders the not-in-force banner and its placeholders.

The footer link to it was removed. The route still resolves and stays out of search indexes; it is
simply not advertised. **Restore the link at the same time as the checkbox, never before.**

## Still open

| Item | Status |
| ---- | ------ |
| External legal review of the published wording | **Not performed.** `EXTERNAL_LEGAL_REVIEW_COMPLETE = false`; publication is the owner's decision, recorded as `OWNER_APPROVED_FOR_PUBLICATION`. |
| Postal address for legally significant requests | **OWNER INPUT REQUIRED.** Omitted rather than invented; the verified mailbox carries every right the notice promises. |
| Backup storage region (U3) | Unverified; needs written vendor confirmation, not another API call. Not asserted anywhere. |
| Analytics consent gate | Metrica initialises on page load with no cookie banner. Whether that is lawful here is a legal question. The notice states the fact and the browser-side opt-out; it asserts no legal basis. |
| Retention of the free-text `comment` field | Retained on the same one-month schedule as the rest of the lead. Counsel may want it shorter. |
| `/consent` and the checkbox | Deferred. See above. |
