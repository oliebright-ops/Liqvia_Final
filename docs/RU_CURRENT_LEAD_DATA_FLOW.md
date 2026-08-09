# RU current lead data flow — verified production state

**Date of audit:** 2026-08-10
**Method:** live DNS/HTTP inspection of `liqvia.info`, read-only aggregate queries against the
production database, and source inspection at checkpoint `fc026f8`.
**Scope:** the `liqvia.info` marketing and lead-generation plane only.

Every system is classified **RU**, **NON-RU** or **UNKNOWN**. *UNKNOWN is not safe* — it means the
jurisdiction has not been established, and it must be treated as NON-RU until it is.

---

## 0. Headline

> Today, a Russian visitor's personal data is collected on `liqvia.info` and written to a
> **PostgreSQL database in Oregon, USA**, with **no consent record of any kind**, against a consent
> sentence that references a privacy policy **which is not reachable on the site**.

None of the consent/privacy framework built at checkpoint `fc026f8` is deployed. This document
describes what is *actually running*, not what is in the repository.

---

## 1. System-by-system classification

| # | System | Role in the RU lead path | Jurisdiction | Evidence |
|---|---|---|---|---|
| 1 | **Cloudflare** | TLS termination / proxy in front of `liqvia.info` | **NON-RU** (global anycast; PoP observed: `PER`) | `server: cloudflare`, `cf-ray: …-PER` on production responses |
| 2 | **Render — `liqvia-landing`** | Serves the landing page and `POST /api/cash-os-leads` | **NON-RU (US)** | `liqvia.info` → CNAME `liqvia-landing.onrender.com` → `216.24.57.1`; `x-render-origin-server: Render` |
| 3 | **Render PostgreSQL — `liqviadb`** | Stores `CashOsLead` rows | **NON-RU — US, Oregon** | host `dpg-…-a.oregon-postgres.render.com`; PostgreSQL 18.4 |
| 4 | **Render platform logs** | Application stdout/stderr | **NON-RU (US)**, retention per Render policy | Render-managed, not configurable by Liqvia |
| 5 | **Render database backups/snapshots** | Backups of `liqviadb` | **NON-RU**, exact policy **UNKNOWN** | Free-plan Postgres; retention not verified in dashboard |
| 6 | **Yandex Metrica** (counter `111417446`) | Analytics on `liqvia.info` only | **RU** | `frontend/src/components/analytics/yandex-metrica.tsx` |
| 7 | **IONOS** | MX/SPF for the `liqvia.info` domain | **NON-RU** (`_spf-us.ionos.com` → US) | `dig MX liqvia.info` → `mx0{0,1}.ionos.com`; SPF `include:_spf-us.ionos.com` |
| 8 | **SMTP (lead notification)** | — | **not in the path** | No mail is sent on lead submission; see §5 |
| 9 | **OpenAI** | — | **not in the path** | No AI call on lead submission; see §6 |
| 10 | **CRM / webhook** | — | **none exists** | No outbound integration in `CashOsLeadsService` |
| 11 | **Developer workstation** | Holds production DB credentials | **NON-RU** (operator's machine) | see §8 — this is a finding |

**Nothing in the current lead path is in Russia except the analytics counter**, and analytics is the
one component that must *not* be the lead store.

---

## 2. Which service serves `liqvia.info`

```
liqvia.info.        CNAME  liqvia-landing.onrender.com.   → 216.24.57.1 (Render, US)
liqvia.info.        NS     ns10{16,20,25}.ui-dns.{org,com,de}  (IONOS DNS)
liqvia.info.        MX     mx00.ionos.com / mx01.ionos.com
liqvia.info.        TXT    "v=spf1 include:_spf-us.ionos.com ~all"
```

**`render.yaml` does not describe production.** It declares a service named `liqvia2` with a database
`liqvia2-db`; the service actually serving `liqvia.info` is **`liqvia-landing`**, which appears
nowhere in the blueprint. It also declares **no `region:`**, so anything created from it would
default to Oregon.

> **Answer to Phase A.5 — yes, the Render dashboard overrides `render.yaml`.** The blueprint is
> stale and must not be treated as a description of production. Any RU work that assumes
> `render.yaml` is authoritative will be wrong.

**Deployed commit.** `origin/landing-production` is at `78ad445` ("Scope Metrica to production
landing hosts") and the local branch is level with it. The live site's behaviour matches that
commit, so **Render deploys from `landing-production`**. This is why the checkpoint was committed to
`ru/consent-privacy-checkpoint` instead — pushing to `landing-production` would have deployed it.

---

## 3. What is deployed vs. what is in the repository

Verified by requesting each route without following redirects:

| Route | Production response | Meaning |
|---|---|---|
| `/privacy` | `307 → /` | **Not deployed.** The privacy policy does not exist publicly. |
| `/consent` | `307 → /` | **Not deployed.** The consent document does not exist publicly. |
| `/login`, `/dashboard` | `307 → /` | Correctly withheld from the marketing host. |
| `/` | `200` | Landing page. |

The deployed consent sentence, transcribed verbatim from the served HTML:

> «Отправляя форму, вы соглашаетесь с обработкой персональных данных в соответствии с Политикой
> конфиденциальности. Мы используем ваши данные только для связи по вашей заявке и не передаём их
> третьим лицам без вашего согласия.»

Three defects in that one sentence, all live right now:

1. **It is not a consent, it is a notice.** «Отправляя форму, вы соглашаетесь…» is submission-implied
   agreement — there is no unticked box, no affirmative act, and therefore nothing that satisfies a
   requirement for consent to be specific, informed and freely given.
2. **The document it names does not exist.** «Политика конфиденциальности» is not a link, and
   `/privacy` returns a redirect. A consent referring to a document the person cannot read is not
   informed.
3. **The operator is never identified.** The reader is not told whose data-processing they are
   agreeing to.

This wording is now registered as `cash-os-lead-form@2026-08-09.1` so that the historical record is
truthful, and is superseded by `@2026-08-10.1`.

---

## 4. Do RU leads enter the global database, and does consent evidence exist?

**Yes, and no, respectively.** Read-only aggregate queries against `liqviadb`:

| Question (Phase A) | Answer |
|---|---|
| A.6 — do RU leads enter the global database? | **Yes.** `CashOsLead` rows are written to `liqviadb` in Oregon. |
| A.7 — where does `ConsentRecord` reside? | Nowhere. It exists only in the repository. |
| A.8 — is the `ConsentRecord` migration applied in production? | **No.** The `ConsentRecord` table is absent (`information_schema` count = 0). The newest applied migration is `20260808022051_cash_os_lead_optional_phone_industry_size`; `20260809120000_consent_records` has never run. |
| A.12 — does historical consent evidence exist? | **No. Zero records, and no table to hold them.** |

The production `public` schema holds 30 tables — the full authenticated Liqvia application
(`Company`, `UserProfile`, `JournalEntry`, `BankAccount`, `UploadBatch`, …) **in the same database**
as `CashOsLead`. Russian lead data and global financial data are today co-resident with no boundary
between them.

---

## 5. Historical RU leads — inventory (Phase C)

`CashOsLead` contains **4 rows**, all with `source = 'cash-operating-system-landing'`. Inspected by
shape only; no name, email, phone or comment value was read.

| # | Created | Email domain | Name length | Phone length | Comment length | Assessment |
|---|---|---|---|---|---|---|
| 1 | 2026-08-08 13:45Z | `gmail.com` — **matches the operator's own address** | 1 | 0 | 0 | Operator's own smoke test |
| 2 | 2026-08-09 06:51Z | `example.com` | 4 | 4 | 4 | Synthetic |
| 3 | 2026-08-09 06:51Z | `example.com` | 4 | 4 | 4 | Synthetic |
| 4 | 2026-08-09 06:52Z | `example.com` | 4 | 4 | 4 | Synthetic |

> ### `historical_ru_leads = 0`
>
> All four rows are test submissions: one by the operator, three against the reserved
> `example.com` domain with 4-character field values. **No real member of the public has submitted a
> lead through `liqvia.info`.**

**Consequence, and it is a large one:** there is no historical migration to design, no consent
evidence to reconstruct, and no source data to delete. The Yandex database starts **clean**, and the
only open question is where *future* leads go. See `RU_HISTORICAL_LEAD_MIGRATION.md`.

It also means the live consent defects in §3 have **harmed nobody**, and can be fixed before the
first real lead rather than remediated afterwards. This is the single most valuable fact in this
audit — it converts the whole exercise from remediation into prevention. It stops being true the
moment paid traffic is switched on.

---

## 6. Where lead data does *not* go

Each of these was checked in source at `fc026f8`, not assumed.

| Path | Status | Evidence |
|---|---|---|
| **SMTP / email** | **Not in the path.** | `MailService` is injected only by `AuthService` and has exactly one method, `sendPasswordResetEmail`. `CashOsLeadsService` does not import it. No lead notification email exists. |
| **OpenAI** | **Not in the path.** | `CashOsLeadsService` imports only `PrismaService` and `ConsentService`. No AI call on any lead code path. |
| **Yandex Metrica** | **Only non-identifying goals.** | `trackCtaEvent` accepts a closed union of 10 literal event names and calls `ym(id, 'reachGoal', event)` with **no parameters object**. No field value can reach Metrica through it. See `RU_METRICA_VERIFICATION.md`. |
| **URL / UTM** | **No identity in URLs.** | `source` is the hard-coded literal `'cash-operating-system-landing'`, not `window.location`. No lead field is ever placed in a query string. |
| **CRM / webhook** | **None exists.** | No outbound HTTP call anywhere in the lead module. |
| **Logs** | **No lead values logged.** | The three `logger.warn` calls in `CashOsLeadsService` emit a consent version string and a fixed message; `ConsentService` explicitly declines to log submitted text. `redactForLog`/`maskEmail` cover third-party error strings. See §7. |

This is a genuinely good starting position: the current lead funnel has **one** processor of personal
data (the Render database) and no fan-out. The migration's job is to move that one store, not to
untangle a web.

---

## 7. Logging (Phase Q baseline)

`backend/src/security/log-redaction.ts` provides `maskEmail`, `redactForLog` and
`describeErrorForLog`, covering emails, IBANs, long digit runs, grouped digits and phone numbers.
`MailService` uses all three.

**Gap:** redaction is applied where a developer remembered to apply it. There is no framework-level
interceptor guaranteeing that an unhandled exception carrying a request body cannot reach the log
sink. NestJS's default exception filter logs the stack of an unhandled error, and a validation error
on the lead DTO can embed submitted values.

→ Tracked as a Phase Q item in `RU_PRODUCTION_DATA_FLOW.md`. Not a live breach today, because the
only submissions have been synthetic.

---

## 8. Access, backups and downloadability (Phase A.20–22, Phase T)

| Question | Answer |
|---|---|
| A.20 — backup location | Render-managed, same US region. Retention **UNKNOWN** — not verified in the dashboard. |
| A.21 — snapshot behaviour | **UNKNOWN.** The blueprint declares `plan: free`, on which Render's backup guarantees are limited. Must be confirmed before any real data exists. |
| A.22 — can production data be downloaded locally? | **Yes — and it currently is reachable.** |

> ### FINDING — production database credentials on a developer workstation
>
> The repository's root `.env` contains a **live production connection string** for
> `dpg-…-a.oregon-postgres.render.com/liqviadb`, with credentials, giving full read/write access to
> the production database — including every `CashOsLead` row and the entire authenticated
> application's data — from a laptop.
>
> `.env` is correctly gitignored, so nothing leaked into Git. The exposure is local, not public.
>
> This is how the counts in §5 were obtained, which is itself the point: it took no approval, left no
> attributable audit trail, and would have worked just as well against real personal data.
>
> **Recommended (requires owner action, not a code change):**
> 1. Point local `.env` at the Docker Compose database in `docker-compose.yml`, not production.
> 2. Rotate the production Postgres credentials in Render.
> 3. Treat production access as a deliberate, time-boxed, attributable act. See `RU_ACCESS_CONTROL.md`.

> ### FINDING — real client data is untracked and not gitignored
>
> `qa/ok-bankrot/` (2.1 MB) contains client QA material including a file named
> `CONFIDENTIAL_name_mapping.csv`, plus bank transactions and ageing reports. It is **untracked and
> not matched by `.gitignore`**, so a routine `git add -A` would commit real client data to a GitHub
> repository.
>
> It was deliberately excluded from checkpoint `fc026f8`. **Add `qa/` to `.gitignore` before the
> next commit by anyone.** Unrelated to the RU migration; reported because it was found on the way.

---

## 9. Answers to Phase A, in order

| # | Question | Answer |
|---|---|---|
| 1 | Service serving `liqvia.info` | Render service `liqvia-landing`, behind Cloudflare |
| 2 | Render service region | **US (Oregon)** — inferred from the co-located database host and the blueprint's absent `region:` |
| 3 | Production PostgreSQL provider | Render Managed PostgreSQL |
| 4 | PostgreSQL region | **US — Oregon** (`oregon-postgres.render.com`), PostgreSQL 18.4 |
| 5 | Dashboard overrides `render.yaml`? | **Yes.** The live service is not in the blueprint at all |
| 6 | RU leads in the global database? | **Yes** |
| 7 | Where does `ConsentRecord` reside? | Repository only — nowhere in production |
| 8 | `ConsentRecord` migration applied? | **No** |
| 9 | Russian leads exist historically? | **No real ones** |
| 10 | How many | **4 rows, all test** (1 operator, 3 `example.com`) |
| 11 | Fields they contain | `name, role, companyName, phone, email, employeeCount, industry, comment, source, createdAt` |
| 12 | Historical consent evidence? | **None**, and no table |
| 13 | Lead data into SMTP/email? | **No** — no lead notification exists |
| 14 | Actual SMTP provider | None configured for leads. Domain mail is **IONOS**. See `RU_SMTP_DATA_FLOW.md` |
| 15 | SMTP jurisdiction | **NON-RU (US)** per `_spf-us.ionos.com` |
| 16 | Lead content in logs? | **No lead values.** Framework-level gap noted in §7 |
| 17 | Lead content to OpenAI? | **No** |
| 18 | Lead content to Metrica? | **No** — fixed goal names only, no parameters |
| 19 | CRM/webhook receiving leads? | **None** |
| 20 | Backup location | Render, US region |
| 21 | Snapshot behaviour | **UNKNOWN** — free plan, unverified |
| 22 | Production data downloadable locally? | **Yes** — see §8 |

---

## 10. What this means for the migration

1. **There is no historical data problem.** Phase Z is not required. Start clean.
2. **There is a deployment problem.** The consent framework exists and is untested in production;
   `render.yaml` does not describe reality; the deploy branch auto-publishes.
3. **There is a jurisdiction problem, and it is narrow.** Exactly one store (`liqviadb`, Oregon) and
   one compute tier (`liqvia-landing`, US) need a Russian counterpart. Nothing else fans out.
4. **The window is open but closing.** Every finding above is currently harmless because no real
   person has submitted a lead. Switching on Yandex Direct converts all of them into live incidents
   simultaneously. Paid traffic must not start before the cutover in `RU_CUTOVER_PLAN.md`.

**LEGAL REVIEW REQUIRED** for every conclusion about statutory obligations in this document. Nothing
here is a legal opinion, and nothing here says any part of Liqvia is compliant with 152-FZ.
