# RU consent implementation — proposed wording, changes, and GO/NO-GO

**Date:** 2026-08-10
**Branch:** `landing-production`
**Scope:** operator identification, required lead-form consent, optional marketing consent,
`/consent` document, privacy-policy rewrite, server-side enforcement, tests.
**Deployment status:** **NO-GO.** Nothing here has been deployed. See §7.

---

## 1. Operator details as implemented

Single source of truth: [`packages/shared/src/operator.ts`](../../packages/shared/src/operator.ts).
Every legal page, the consent wording and the footer read from it, so the identification cannot
drift between documents.

| Field | Value |
| --- | --- |
| Full name | Оли Брайт Бабатунде |
| Status | физическое лицо, не индивидуальный предприниматель |
| ИНН | **Not published.** Held as private configuration (`RU_OPERATOR_INN`), never in Git or a client bundle — see §1.1 |
| Canonical line | «Оператор персональных данных: Оли Брайт Бабатунде, физическое лицо» |
| Dative (consent wording) | Оли Брайту Бабатунде |
| Genitive (marketing wording) | Оли Брайта Бабатунде |
| Contact email | `olie.bright@gmail.com` — supplied and verified by the operator 2026-08-10 (commit `9a1d99e`). Used for subject requests and consent withdrawal only, never for marketing |
| Postal address for requests | **`null` — not supplied.** Open owner input; does **not** gate publication — see §7 |

**Confirm the name against the source document before deployment.** It was taken from the
instruction and has not been verified against anything else.

### 1.1 Public identity vs private configuration

`packages/shared/src/operator.ts` exports **only** the operator facts a public legal document is
required to carry. It is imported by the frontend, so everything it exports is readable by any
visitor in the client bundle.

| Classification | Fields |
| --- | --- |
| **PUBLIC LEGAL DISCLOSURE** | full name, declension forms, legal status, contact email *(when verified)*, postal address for requests *(when verified)* |
| **PRIVATE CONFIGURATION** | ИНН, any internal registration reference |

Private facts are read at runtime through `operatorPrivateConfig()`, which sources them from the
environment (`RU_OPERATOR_INN`, `RU_OPERATOR_REGISTRATION_REF`) and **throws if called in a
browser**. No private identifier is a constant, so none can be committed to Git or bundled.

**Why the ИНН is not published.** 152-FZ requires a personal-data policy and a consent notice to
identify the operator and to give an address for requests; neither names a tax identifier as
required content. For a natural-person operator, publishing an ИНН discloses an extra identifier
about an individual with no corresponding legal benefit — which is what data minimisation argues
against. `assertOperatorDesignation()` now throws on any wording matching `ИНН <digits>`, so
reintroducing it is a deliberate act, not an accidental one.

> **LEGAL REVIEW REQUIRED.** If counsel confirms the ИНН must appear in a specific public notice,
> reintroduce it *in that notice only*, as a **new** consent version, sourced from
> `operatorPrivateConfig()`. Do not restore the constant.

**Git history:** the ИНН was never committed. Every file that contained it was untracked at the
time of removal, verified by `git log --all -S`. No history rewriting is required or proposed.

`assertOperatorDesignation()` runs over every registered consent wording at module load and throws
on `ОГРНИП`, on an affirmative «индивидуальный предприниматель», and on `ИП` used as a designation.
The negated status line «не индивидуальный предприниматель» is explicitly allowed. Asserted by
`backend/src/consent/consent-registry.spec.ts`.

No address, email, registration status or other legal detail has been invented anywhere. Where a
fact is unknown the documents render a visible «НЕ УСТАНОВЛЕНО» marker instead of a value.

---

## 2. Proposed wording

### 2.1 Required consent checkbox (implemented, unticked, blocking)

> Я даю Оли Брайту Бабатунде согласие на обработку моих персональных данных,
> указанных в форме, с целью рассмотрения моего обращения, связи со мной, организации и проведения
> консультации в соответствии с отдельным **Согласием на обработку персональных данных**. Я
> ознакомлен(а) с **Политикой обработки персональных данных**.

Registered as `cash-os-lead-form@2026-08-10.1`, policy version `2026-08-10.1`.
The two bold phrases render as separate links to `/consent` and `/privacy`, both
`target="_blank" rel="noopener noreferrer"`.

The sentence is stored once, in the registry. The UI splits it on those two phrases
(`segmentConsentText`) and a test asserts the segments reassemble into the identical string, so
what the user reads is character-for-character what is stored as evidence.

### 2.2 Optional marketing consent (implemented, **not rendered**)

> Я отдельно соглашаюсь получать информационные и рекламные сообщения от Оли Брайта Бабатунде
> по указанным мной контактным данным. Я могу отказаться от сообщений в любое
> время, направив обращение по адресу «‹подтверждённый email›».

This wording is **built from** the verified contact address rather than stored with a placeholder,
because the sentence promises an opt-out channel. While `OPERATOR_CONTACT_EMAIL` is `null`:

- `buildMarketingConsentText()` returns `null`;
- the notice is absent from the consent registry;
- `MARKETING_CONSENT_ENABLED` is `false` and the checkbox is not rendered;
- the server drops any marketing consent a stale client posts — **without rejecting the lead**.

A second gate, `PROMOTIONAL_MESSAGES_ARE_SENT` (currently `false`), reflects the business fact that
no promotional messages are sent today. Both must be true before the box appears.

### 2.3 Informational-legal disclaimer

Added verbatim as privacy-policy section 13, titled «Информационно-правовая оговорка». Stored as
`SITE_DISCLAIMER_RU` in `frontend/src/lib/legal-text.ts` and asserted by test, so it cannot be
paraphrased.

---

## 3. Files changed

### New

| File | Purpose |
| --- | --- |
| `packages/shared/src/operator.ts` | Operator identity, contact gate, prohibited-designation guard |
| `frontend/src/app/consent/page.tsx` | `/consent` — Согласие на обработку персональных данных |
| `frontend/src/components/legal/legal-chrome.tsx` | Shared operator line, draft banner, «НЕ УСТАНОВЛЕНО» marker, section chrome |
| `frontend/src/lib/legal-publication.ts` | Publication gate and the list of unverified facts |
| `frontend/src/lib/legal-text.ts` | Disclaimer and document titles as asserted constants |
| `backend/src/consent/consent-registry.spec.ts` | Wording, archive and designation tests (16) |
| `backend/src/cash-os-leads/cash-os-leads.service.spec.ts` | Server-side enforcement tests (9) |
| `frontend/src/lib/legal-publication.test.ts` | Publication gate and link tests (7) |
| `docs/legal/RU_CONSENT_IMPLEMENTATION.md` | This document |

### Modified

| File | Change |
| --- | --- |
| `packages/shared/src/consent.ts` | New required wording `2026-08-10.1`; `obligation` field; marketing subject; link phrases; `segmentConsentText`; policy version → `2026-08-10.1`. V1 wording retained in the archive. |
| `packages/shared/src/index.ts` | Exports `./operator` |
| `frontend/src/lib/consent.ts` | Re-exports the new registry surface and the operator identity |
| `frontend/src/components/cash-os/lead-form.tsx` | New checkbox immediately before the submit button; Russian validation message; a11y label/`aria-invalid`/`aria-describedby`; optional marketing box behind its gate; `ym-hide-content` / `ym-disable-keys`; sends `accepted: true` and the version |
| `frontend/src/app/privacy/page.tsx` | Operator identified; retitled «Политика обработки персональных данных»; sections for purposes+bases, operations, processors, Metrica, AI, location/cross-border, retention, security, rights, consent records, disclaimer |
| `frontend/src/middleware.ts` | `/consent` added to `LANDING_ALLOWED_PREFIXES` |
| `frontend/src/components/cash-os/footer.tsx` | Operator line; links to both documents by their real titles |
| `backend/src/cash-os-leads/dto/create-cash-os-lead.dto.ts` | `accepted` flag; optional `marketingConsent` |
| `backend/src/cash-os-leads/cash-os-leads.service.ts` | `assertRequiredConsent`, `resolveMarketingConsent`, second consent row in the same transaction |
| `frontend/src/middleware.test.ts` | `/consent` reachability on all three landing hosts, both host headers |

### Amendments of 2026-08-10 (post-audit)

An audit of this implementation against the live site raised three gaps. All three are
addressed below; none changes the wording, so no new consent version was needed.

| # | Gap | Change |
| --- | --- | --- |
| B | The checkbox's behaviour was verified only by manual DOM inspection — no automated test would have caught it silently becoming pre-ticked, optional, or detached from its wording | New `frontend/src/lib/lead-submission.ts` extracts the "no tick, no payload" rule out of the event handler so it is testable as an ordinary function. New `lead-submission.test.ts` (10 tests) and `lead-form.test.ts` (10 tests, rendered via `react-dom/server`). New `tsconfig.test.json` supplies the automatic JSX runtime that Next's `jsx: "preserve"` withholds from the test runner. |
| C | `ConsentRecord` had no form source; it was reachable only through a `SetNull` link, so a hard-deleted lead left evidence that no longer said which form obtained it | New `source` column on `ConsentRecord` in both schemas, migrations `20260810140000_consent_source` (global and RU), populated from `dto.source`. Nullable, no backfill: NULL means "not captured", which is the truth for earlier rows. |
| D | `accepted` was optional, so a client that omitted it still produced a stored consent — silence recorded as an acknowledgement | `assertRequiredConsent` now requires `accepted === true`; `resolveMarketingConsent` applies the same rule and drops rather than rejects. `accepted` is now a required DTO property. |

Also added: `backend/src/cash-os-leads/lead-consent-persistence.integration.spec.ts` — the first
test in this area to touch a real database, proving the lead and consent rows link, that the
`source` column was actually migrated, and that consent evidence survives a hard delete of its
lead. It is **skipped unless `CONSENT_TEST_DATABASE_URL` is set** and refuses any URL equal to
`DATABASE_URL` or not on localhost / marked `test`, because of §F1 below.

Unchanged by the amendments: the wording, its version, the policy version, the operator identity,
and the GO/NO-GO position in §8 — which remains **NO-GO** for the reasons in §7.

---

## 4. Behaviour of the required checkbox

| Requirement | How it is met |
| --- | --- |
| Separate checkbox, immediately before submit | Own `<div>` directly above the submit button; only its own error message can appear between them |
| Empty by default | `useState(false)`; no default-checked path exists |
| Required for submission | Native `required` **and** an explicit guard in `onSubmit` **and** server-side rejection |
| Enforced on the server | `assertRequiredConsent` — subject must be `cash-os-lead-form`, version must be registered as `required`, `accepted: false` is a refusal |
| Accessible label | `<input id>` + `<label htmlFor>`, `aria-invalid`, `aria-describedby` pointing at a `role="alert"` message |
| Clear Russian validation message | `setCustomValidity(CONSENT_REQUIRED_MESSAGE_RU)` replaces the browser-default message; the same sentence is the server's rejection message |
| Not combined with advertising consent | Different subject id, different record, different method (`checkbox` vs `checkbox-optional`); the marketing box never gates submission |
| Records version and UTC timestamp | `ConsentRecord.version`, `.policyVersion`, `.acknowledgedAt` (Prisma `TIMESTAMP(3)`, stored UTC). The timestamp is captured when the box is ticked, not at submit; client clocks more than an hour from the server are replaced with server time |
| Opening a legal link does not erase input | Both links `target="_blank"` and `stopPropagation()`, so neither navigates the page nor toggles the checkbox; campaign parameters on the landing URL are untouched |

**Campaign protection.** `/consent` was added to the landing-host allowlist alongside `/privacy`,
and both are covered by tests that assert `?yclid=…&utm_source=…` survives. Metrica goals are
unchanged — `ym-hide-content` and `ym-disable-keys` affect only Webvisor session recording, not
`reachGoal`, the click map or traffic reporting.

---

## 5. Tests

| Suite | Command | Result |
| --- | --- | --- |
| Consent registry + operator designation (16 tests) | `cd backend && npx jest src/consent` | **pass** |
| Lead enforcement + RU boundary + notification (32 tests) | `cd backend && npx jest src/cash-os-leads` | **pass** — 48 total with `src/consent`, 3 skipped |
| Lead + consent persistence, real database (3 tests) | `CONSENT_TEST_DATABASE_URL=… npx jest lead-consent-persistence` | **not run** — skipped by default; see §F1 |
| Frontend middleware, publication gate, form markup, submission guard (55 tests) | `pnpm --filter @liqvia2/frontend test` | **pass** |
| Frontend type-check | `cd frontend && npx tsc --noEmit` | **clean** |
| Backend type-check | `cd backend && npx tsc --noEmit` | **clean** |
| ESLint over changed paths | `npx eslint …` | **clean** |
| Production build | `pnpm --filter @liqvia2/frontend build` | **clean**, `/consent` and `/privacy` both emitted as static routes |

Verified live against the production build (`next start`), by DOM inspection rather than by eye:

- checkbox present, **unchecked**, `required`, `validationMessage` = the Russian sentence, form
  invalid while unticked, valid once ticked;
- label text is byte-identical to the approved wording;
- both links resolve to `/consent` and `/privacy`, `target="_blank" rel="noopener noreferrer"`;
- clicking a legal link **does not** toggle the checkbox and **does not** clear a filled field
  (tested with a real bubbling `MouseEvent` on the anchor inside the label);
- the form element carries `ym-hide-content ym-disable-keys`;
- the marketing checkbox is **absent**, as intended;
- the submit button is not disabled, so the Russian validation message can actually surface;
- the consent block is the element immediately preceding the submit button;
- both legal pages render `noindex, nofollow` and the draft banner, contain the operator line
  verbatim, and contain **no** `ОГРНИП` anywhere;
- the disclaimer appears verbatim as privacy-policy section 13;
- the footer carries the operator line and links to both documents by their real titles.

> The full backend suite was **not** run. `docs/FINAL_OUTSTANDING_ISSUES.md` §F1 records that
> `backend/.env` points at the production database and that `upload-import.service.spec.ts` writes
> to it. Only the two suites above were executed, and neither constructs a real `PrismaService`.

Lead-delivery regression coverage: a submission carrying the superseded `2026-08-09.1` wording is
still accepted and still writes the lead (test: "still delivers the lead when a cached client posts
a superseded wording version"). This is deliberate — a browser holding a cached bundle across the
wording change must not lose its lead. The evidence records the version that person actually saw,
and the mismatch is logged.

---

## 6. Migration and rollback

### 6.1 Database

**No new migration is required by this change.** The optional marketing consent is a second row in
the existing `ConsentRecord` table with a different `subjectId`, not a new column.

One migration is pending from earlier work and will apply on the next deploy:

- `backend/prisma/migrations/20260809120000_consent_records/migration.sql`
- Creates `ConsentRecord` + three indexes + an FK to `CashOsLead` with `ON DELETE CASCADE`.
- Applied automatically at boot: `backend/src/nest-app.ts` → `runMigrations()` → `prisma migrate deploy`.
- **Additive only.** It creates a new table and alters no existing one, so it cannot fail on
  existing data and does not lock `CashOsLead`.

**Review required before deploy:** confirm on the live database that `ConsentRecord` does not
already exist (the migration would fail) and that the deployed instance is the one serving
production — `docs/FINAL_OUTSTANDING_ISSUES.md` §U2 records that `render.yaml` declares
`liqvia2-db`/`liqvia2` while the live URL uses `liqviadb`, so the blueprint is not the deployed
truth.

### 6.2 Rollback

| Step | Action |
| --- | --- |
| Application | `git revert` the deploy commit and redeploy. The frontend and backend changes are stateless. |
| Consent wording | Revert restores `2026-08-09.1` as active. Records written against `2026-08-10.1` remain readable because the archive is append-only — **do not delete archive entries when reverting.** |
| Database | Leave `ConsentRecord` in place. Dropping it destroys consent evidence, which is the one thing that must survive a rollback. An unused table costs nothing. |
| Partial rollback | To stop collecting leads without reverting code, the checkbox cannot be bypassed — the server rejects submissions lacking it. Disable at the form or route level instead. |

The forward migration is additive and the rollback is "leave the table"; there is no destructive
down-migration and none should be written.

---

## 7. Unresolved facts — deployment blockers

**Restated 2026-08-10 to match the code, which had moved on from the table below.** The authority
is `publicationBlockers()` / `openOwnerInputs()`; this section is a description of them and must be
re-derived, not edited from memory, whenever either changes.

Anything still in `UNVERIFIED_PROCESSING_FACTS` renders on the pages as a visible «НЕ УСТАНОВЛЕНО»
marker. While any remains, `isLegalPublicationReady()` is `false`, both pages render the
"проект документа — не опубликован" banner and are `noindex`.

### Still blocking publication

Exactly the three facts `publicationBlockers()` returns today. All three describe where the RU
infrastructure actually is, and all three became answerable when the Yandex cutover was executed
(commit `bafb68b`) — they are open because nobody has written the answers down, not because the
answers are unknown.

| # | Unresolved fact | Needed for | Who can answer |
| --- | --- | --- | --- |
| 1 | Web-service hosting region (U1) | Storage location | Yandex Cloud console |
| 2 | Database region, confirmed in console (U2) | Storage location, ст. 18 localisation | Yandex Cloud console |
| 3 | Backups: existence, cadence, retention, region (U3) | Storage location | Yandex Cloud console |

### Open, but deliberately not blocking

| Item | Status |
| --- | --- |
| Postal address for legally significant requests | `null`. Returned by `openOwnerInputs()`, not by `publicationBlockers()`: every right the documents promise — access, correction, deletion, withdrawal — is exercisable by email, so the documents are not untrue without it. Whether they can stand indefinitely without one is a legal question. **LEGAL REVIEW REQUIRED.** |
| External legal review | `EXTERNAL_LEGAL_REVIEW_COMPLETE = false`. Tracked separately and does not gate publication; that is the owner's recorded decision (`OWNER_APPROVED_FOR_PUBLICATION = true`). Never conflate the two constants. |
| Analytics cookies set before any consent (Y6) | Unchanged and unresolved. No cookie banner exists. Owner decision, and not in this change's scope. |
| Cross-border transfer countries and basis | Follows from U1–U3 above; write it once those are answered. |

### Resolved since this document was first written

| Item | Resolution |
| --- | --- |
| Verified contact email | Supplied by the operator: `olie.bright@gmail.com` (commit `9a1d99e`). `isOperatorContactVerified()` is now `true`. |
| SMTP provider identity (U6) | No lead email path exists at all — `docs/RU_CURRENT_LEAD_DATA_FLOW.md` |
| OpenAI terms in force (U7) | No lead data reaches any AI provider, so they do not apply |
| Metrica Webvisor / form recording (U8, U9) | Verified off against the live counter — `docs/RU_METRICA_VERIFICATION.md`; the form additionally carries `ym-hide-content` / `ym-disable-keys` |
| Retention per category (Y10) | Owner decision: leads 1 month; consent evidence retained separately |
| `COUNSEL_SIGN_OFF_COMPLETE` | Renamed `EXTERNAL_LEGAL_REVIEW_COMPLETE` and demoted out of the publication gate |

The **marketing** checkbox is no longer blocked by a missing opt-out address — the email supplies
one — but it remains deliberately disabled: `PROMOTIONAL_MESSAGES_ARE_SENT = false`, so
`MARKETING_CONSENT_ENABLED` is `false`, the notice is not registered, the box is not rendered, and
the server rejects any marketing consent a client posts. Asking for consent to something that never
happens is its own defect. Enabling it is a separate, deliberate decision.

---

## 8. GO / NO-GO

### **NO-GO — do not deploy.**

The implementation is complete and tested; the *facts* are not. Against the stated blockers:

**Restated 2026-08-10, measured rather than remembered.** Marker counts come from the built
static pages in `.next/server/app`, not from an earlier draft of this table.

| Blocker | Status |
| --- | --- |
| Operator's contact email or required address missing | **CLEAR** — email supplied and verified (`9a1d99e`); `isOperatorContactVerified()` is `true`. The postal address is still `null` but is an open owner input, not a blocker — see §7 |
| Policy or consent contains placeholders | **HIT** — 24 «НЕ УСТАНОВЛЕНО» markers still render (16 on `/privacy`, 8 on `/consent`). Both pages carry «не опубликован и не вступил в силу» and `noindex, nofollow` |
| Data recipients or processing purposes unknown | **CLEAR** — U6/U7/U8/U9 resolved; purposes established |
| Production storage / localisation unresolved | **HIT** — U1, U2, U3 remain the only entries in `UNVERIFIED_PROCESSING_FACTS`, and they are what keeps `isLegalPublicationReady()` `false` |
| Server-side consent enforcement absent | **CLEAR** — implemented and tested; `accepted === true` now required |
| Migration / rollback plan not reviewed | **OPEN** — §6 has still not been reviewed, and two migrations now ship (`20260809120000_consent_records`, `20260810140000_consent_source`) |
| Testing reveals a regression in lead delivery or attribution | **CLEAR** — no regression; superseded-version delivery, campaign parameters and Metrica goals all covered by test |

Five of the seven are now clear. The two that remain are both real:

1. **The pages would go live declaring themselves not in force.** Deploying the checkbox now ships
   a consent that links to two documents which say, in their own banner, that they are not
   published and have not taken effect, and which show 24 unfilled facts. A consent notice pointing
   at a document marked "not in force" is weaker evidence than no notice at all, because it is
   evidence that the operator knew the document was incomplete.
2. **The migrations have not been reviewed against the live database.** See §6.

Both are cleared by answering U1–U3 from the Yandex console and reviewing §6 — neither needs new code.

### What a GO requires

Restated 2026-08-10. Items 1, 3 and 5 of the original list are done or superseded; what is left is
short and none of it is code.

1. **Answer U1, U2, U3 from the Yandex Cloud console** — web-service region, database region,
   and backup existence/cadence/retention/region. Write the answers into `/privacy` and delete the
   three entries from `UNVERIFIED_PROCESSING_FACTS`. This is the only thing keeping
   `isLegalPublicationReady()` `false`, and therefore the only thing keeping 24 «НЕ УСТАНОВЛЕНО»
   markers, the draft banner and `noindex` on the two documents the checkbox links to.
2. **Review §6 against the live database** before the migrations run: confirm `ConsentRecord` does
   not already exist there (the migration would fail), and confirm the instance being migrated is
   the one actually serving `liqvia.info` after the Yandex cutover.
3. **Decide how analytics consent is obtained**, or accept the current position knowingly. No
   cookie banner exists.
4. **Decide on the postal address** — supply one, or record the decision that email alone is the
   channel. Non-blocking either way; it stays in `openOwnerInputs()` until answered.
5. Re-run the suites; `isLegalPublicationReady()` then returns `true`, the banner disappears and
   both pages become indexable.
6. Separately from this change, address §F1 (production credentials in `backend/.env`) and §F3
   (`qa/` not gitignored) from `docs/FINAL_OUTSTANDING_ISSUES.md` before any Russian lead is
   collected.

Until then: the code may be merged, but the Russian lead collection and the Yandex campaign must
stay off.
