# Liqvia — Final Outstanding Issues Verification Audit

**Date:** 2026-08-09
**Scope:** verification only. No implementation phase was started. No RU infrastructure was built.
**Method:** re-tested the current working tree (branch `landing-production`, HEAD `78ad445` + uncommitted
Phase 0–2 work). Every status below carries evidence — a file path, a command output, a test result, or an
explicit statement that the fact cannot be established from this repository.

---

## 0. LIQVIA CURRENT STATUS — executive dashboard

| Area                            | Status | One-sentence reason                                                                                                          |
| ------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------- |
| **GLOBAL PRODUCT**              |   🟡   | Functionally sound and 251/255 backend tests pass, but production database credentials sit in a developer `.env` that the test suite writes to. |
| **AI PRIVACY**                  |   🟢   | Exactly one outbound AI call site remains, guarded by a strict allowlist, an independent key sweep, ESLint and a build-failing scan test — 78 gateway tests pass. |
| **CORE FINANCIAL ENGINE**       |   🟡   | Deterministic and untouched by Phases 0–2, but two pre-existing test failures in budget variance sign and budget-sample validation are unexplained. |
| **RUSSIAN LANDING PAGE**        |   🟡   | Live and correctly host-isolated, but `/privacy` is unreachable on `liqvia.info` (verified 307 → `/`).                        |
| **YANDEX ADVERTISING**          |   🔴   | Cannot start: the consent notice links to a policy that 307-redirects away, U8 (Webvisor) is unverified, and the account/entity question is unresolved. |
| **RUSSIAN LEAD COLLECTION**     |   🔴   | The consent mechanism is technically complete but the linked policy cannot be opened from the collecting domain.              |
| **RUSSIAN SYNTHETIC DEMO**      |   🟢   | A complete synthetic seed exists and no personal data is involved; nothing blocks a demo today.                               |
| **RUSSIAN AGGREGATED-DATA PILOT** | 🟡   | Technically safe for aggregated non-personal figures, but the operating entity is undetermined and hosting region unconfirmed in console. |
| **RUSSIAN RAW CUSTOMER DATA**   |   🔴   | No data-region concept exists (R8 unbuilt by design), and raw uploads still land in a single global US-hosted database.       |
| **FULL RU SELF-SERVICE**        |   🔴   | Requires the entire deferred Phase 3 data plane plus a business decision that current strategy documents advise against.      |

---

## 1. Findings requiring attention before anything else

Three items were discovered during **this** audit and appear in no previous document.

### F1 — Production database credentials are on the developer laptop, and the test suite writes to them

`backend/.env` contains:

```
DATABASE_URL=postgresql://brightolie:***@dpg-d8ncrgi8qa3s73f08st0-a.oregon-postgres.render.com/liqviadb
```

`backend/jest.config.js:5` declares `setupFiles: ['<rootDir>/src/load-env.ts']`, and
`backend/src/load-env.ts:34-42` loads `backend/.env` into `process.env` for every Jest run. The specs in
`backend/src/uploads/upload-import.service.spec.ts` construct a real `PrismaService` and write rows.

**This is not theoretical. Running `pnpm --filter @liqvia2/backend test` during this audit connected to the
production database and wrote to it.** Two of the four tests in that file passed, which means:

- `beforeAll` upserted a `Company` row `demo-consulting` into production (`upload-import.service.spec.ts:15-19`);
- one `bank_transactions` `UploadBatch` plus a transaction row (`Txn Test Account` / `Test supplier payment` / 2500 OUT) was created;
- one `ar_ageing` `UploadBatch` plus an AR row (`Test Co` / `INV-TEST-<timestamp>`) was created.

The other two tests timed out at Jest's 5 s limit while awaiting the same production connection. Jest does not
cancel in-flight promises, so their writes — which include `deleteBatch` calls that clear and restore live data
for the `demo-consulting` company — may also have completed after the timeout.

I have **not** attempted to delete anything from production. Cleanup is a destructive operation against a live
database and is your call, not mine.

This is simultaneously the direct answer to **Y7**, **U11** and part of **U2**, and it is the highest-priority
item in this report.

### F2 — `/privacy` is unreachable on the Russian landing domain

`frontend/src/middleware.ts:54-60` defines `LANDING_ALLOWED_PREFIXES`. `/privacy` is not in it, so
`middleware.ts:127-133` redirects it to `/`.

Verified against a running dev server (`next dev`, port 3001):

```
=== /privacy as ORDINARY host (app domain) ===
status=200 redirect=
=== /privacy as LANDING host (liqvia.info) ===
status=307 redirect=http://localhost:3001/
=== / as LANDING host (control) ===
status=200 redirect=
=== x-forwarded-host variant (how Render presents it) ===
status=307 redirect=http://localhost:3001/
```

Both link paths are affected: the consent checkbox (`frontend/src/components/cash-os/lead-form.tsx:216-222`)
and the footer (`frontend/src/components/cash-os/footer.tsx:19-20`). On `liqvia.info` — the only host that
displays the consent notice — a user who clicks "Открыть Политику конфиденциальности" is bounced to the
landing root.

**Consequence:** R9 is not closed. The consent notice still references a policy the user cannot open, which is
the precise defect R9 described. This is a one-line technical fix, but it must be made and re-verified before
any Russian lead is collected.

### F3 — A real Russian client re-identification key is in the working tree and is not gitignored

`qa/ok-bankrot/CONFIDENTIAL_name_mapping.csv` — 79 data rows, header:

```
Branch,Invoice Number,Original Client Name (source file),Pseudonymized Name (used in Liqvia),Outstanding Amount (RUB),Manager
```

This is the table that maps real client names to the pseudonyms used inside Liqvia, together with RUB balances
and manager names — i.e. the key that reverses the pseudonymisation, alongside AR/AP/bank CSVs and QA
documents for the same engagement. `Liqvia_Funding_Residency_Roadmap.docx` §Phase 0–1 refers to "the OK
Bankrot-style engagement" and "the OK Bankrot pilot (pseudonymised)", so this is real client material, not
synthetic fixtures.

`git check-ignore` returns nothing for the path: **`qa/` is untracked but not ignored**, so a single
`git add -A` would commit real Russian client identities to the repository history.

Two separate conclusions follow: (a) add `qa/` to `.gitignore` immediately; (b) Russian client-data processing
has already begun in a QA capacity, which is a material input to Part 13 below.

---

## 2. PART 1 + PART 2 — reconciliation of every previous finding, with evidence

Every previously recorded finding has exactly one status. "Evidence" means something re-tested today, not the
existence of code intended to fix it.

### RED findings (R1–R9)

| ID     | Finding                                                       | Status                     | Evidence                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Counterparty names + raw bank narratives sent to OpenAI        | **RESOLVED**               | Repo-wide grep for `fetch(`, `axios`, `https?://` across `backend/src` returns exactly two hits, both in `backend/src/ai-gateway/providers/openai.provider.ts:18,67`. Payload probe on synthetic data (§6) shows only `counterpartyCode` values and zero narrative text. `decision-quality.spec.ts` "carries no narrative text at all" passes. |
| **R2** | Up to 12 000 chars of raw PDF text sent to OpenAI              | **RESOLVED**               | Call site deleted, not rerouted. `backend/src/uploads/ai-upload.service.ts:234` now carries only a comment recording the removal; `resolveLowConfidence()` (`:324-345`) throws `BadRequestException` or returns a manual-mapping response instead. No `fetch` remains in that file. |
| **R3** | Eight complete raw upload rows sent to OpenAI                  | **RESOLVED**               | Same file, `:304` comment records the removal; the low-confidence branch returns headers-and-warnings only. Verified by the same repo-wide outbound-HTTP grep.                                                                     |
| **R4** | Full context + verbatim question persisted to `AiInsight.context` | **RESOLVED**            | `backend/src/ai/ai.service.ts:529-559` builds an `AiInsightAudit` containing `schemaVersion`, `payloadDigest`, four scalar metrics, `questionCategory`, `redactionCounts` and provenance. No context object and no question text. Written at `:561-568`. |
| **R5** | `UploadBatch.rowSnapshot` stores verbatim rows forever         | **OPEN — ACTION REQUIRED** | Confirmed still present (`backend/prisma/schema.prisma:567`) and still written in full (`upload-import.service.ts:93`). Full functional analysis and recommendation in Part 5 below.                                              |
| **R6** | "Data Residency Controls" advertised in 4 locales               | **RESOLVED**               | `grep -i "residency\|резидент\|résidence\|residencia" frontend/src/locales/*.json` returns **zero matches**. `frontend/src/components/home/security-trust-section.tsx:7-11` carries an explicit do-not-re-add comment and a three-card list with no residency claim. |
| **R7** | RU landing leads stored in the non-RU global database           | **DEFERRED — RU INFRASTRUCTURE** | Unchanged and intentionally so. `cash-os-leads.service.ts:37-50` writes to the single global Prisma client. Depends on R8/Phase 3.                                                                                    |
| **R8** | No data-region concept exists                                   | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED** | `grep -ri "dataRegion\|data_region"` across `backend/prisma` and `backend/src` returns nothing. Deliberately not built per the brief.                                                        |
| **R9** | Consent notice references an unpublished policy; no consent record | **OPEN — ACTION REQUIRED** | Split verdict. *Consent record:* **RESOLVED** — `ConsentRecord` model (`schema.prisma:791+`), migration `20260809120000_consent_records`, transactional write (`cash-os-leads.service.ts:37-61`). *Policy reachability:* **NOT RESOLVED** — see F2, verified 307. |

### YELLOW findings (Y1–Y11)

| ID      | Finding                                    | Status                          | Evidence                                                                                                                                                                                                                       |
| ------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Y1**  | Render web service and DB regions unknown  | **OPEN — CONSOLE VERIFICATION** | `render.yaml` still declares no `region:` key (full file re-read). **Partial new evidence:** the live `DATABASE_URL` host is `dpg-…-a.**oregon**-postgres.render.com`, which places the *database* in Render's Oregon (US-West) region. That is direct evidence, not a default-based inference. The *web service* region remains unevidenced. |
| **Y2**  | Backup location/retention unknown          | **OPEN — CONSOLE VERIFICATION** | No backup tooling anywhere in the repo. `render.yaml:5` still says `plan: free`; whether the deployed instance was upgraded in the dashboard cannot be read from here.                                                          |
| **Y3**  | Recipient emails written to logs           | **RESOLVED**                    | `backend/src/security/log-redaction.ts` implements `maskEmail`, `redactForLog`, `describeErrorForLog`. `mail.service.ts:39-40` and `:68-69` both call `maskEmail(to)`; the reset link is explicitly omitted from the log line.  |
| **Y4**  | SMTP provider unidentified                 | **OPEN — CONSOLE VERIFICATION** | `render.yaml:37-43` still marks `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` as `sync: false`. Not determinable from the repository.                                                                                                   |
| **Y5**  | Metrica Webvisor state unverified          | **OPEN — CONSOLE VERIFICATION** | Full repository-side analysis in Part 4. Code sets no `webvisor` flag, but the console setting is independent and authoritative.                                                                                                |
| **Y6**  | Metrica cookies set before any consent     | **OPEN — ACTION REQUIRED**      | `frontend/src/components/analytics/yandex-metrica.tsx:12-37` initialises and injects `tag.js` inside a bare `useEffect` on mount. Nothing in `frontend/src/lib/consent.ts` or the form gates it. There is no cookie banner. The consent checkbox governs the *lead submission* only. |
| **Y7**  | No control preventing prod data on laptops | **OPEN — ACTION REQUIRED**      | Materialised, not merely possible — see F1 and F3. No policy document exists in the repo.                                                                                                                                       |
| **Y8**  | `deployment.md` documents Clerk as auth    | **RESOLVED**                    | `docs/engineering/deployment.md:46-49` now states Liqvia does **not** use Clerk and points at `backend/src/auth/auth.service.ts`. `docs/engineering/architecture-decisions.md:28` records the supersession. Remaining Clerk mentions are historical notes in audit documents. |
| **Y9**  | Free-text template fields will carry names/salaries | **OPEN — ACTION REQUIRED** (RU only) | Unchanged. `Supplier Name`, `Customer Name`, `Description` remain required template headers — confirmed from the QA CSV headers under `qa/ok-bankrot/`. No RU-safe template exists.                                    |
| **Y10** | Lead data has no retention limit or erasure path | **OPEN — ACTION REQUIRED**  | `CashOsLead` (`schema.prisma:765-781`) has no expiry field and no deletion endpoint exists. `ConsentRecord` cascades on lead delete, so an erasure path would be clean to add — it simply has not been added.                   |
| **Y11** | No audit log of who accessed which tenant's data | **OPEN — ACTION REQUIRED** (reduced) | An `AuditLog` model **does** exist and is written on upload import (`upload-import.service.ts:96-104`) and on clearing active data (`:198-205`). It records *writes*, not *reads*. The original finding — no record of who **accessed** data — stands. |

### GREEN findings (G1–G7)

| ID     | Finding                                             | Status            | Evidence                                                                                                                              |
| ------ | --------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | No object storage exists                            | **VERIFIED SAFE** | No S3/R2/GCS/Azure SDK, no outbound HTTP other than the OpenAI adapter (repo-wide grep, two hits, both in the provider file).          |
| **G2** | No browser→third-party signed-URL uploads           | **VERIFIED SAFE** | Same grep across `frontend/src`; no signed-URL or direct-to-storage path.                                                              |
| **G3** | No files written to disk or `/tmp`                  | **VERIFIED SAFE** | Multer memory storage unchanged; nothing in `backend/src/uploads` writes to the filesystem.                                            |
| **G4** | No cron, queues or Redis                            | **VERIFIED SAFE** | No scheduler, queue or cache package in any workspace.                                                                                 |
| **G5** | Metrica only on the RU landing; no GA/Meta/Hotjar   | **VERIFIED SAFE** | Grep for `gtag`, `googletagmanager`, `google-analytics`, `fbq`, `hotjar`, `clarity`, `linkedin`, `pixel`, `amplitude`, `mixpanel`, `posthog`, `segment` across `frontend/src`, `frontend/server-dist`, `backend/src`: **only Yandex Metrica matches.** |
| **G6** | Forecasting is deterministic; AI only narrates      | **VERIFIED SAFE** | Payload probe (§6) shows the model receives pre-computed figures only. `PAYLOAD_CONTRACT_PROMPT` instructs "never recompute". Engine files untouched by Phase 0–2 (`git diff --name-only` shows no treasury/forecast changes). |
| **G7** | Landing host-gating blocks product routes           | **VERIFIED SAFE** *(with caveat)* | Verified live: `/privacy` under `Host: liqvia.info` → 307 to `/`. The gate works. It is currently *too* strict — see F2.       |

### Superseded / not applicable

| Item                                                     | Status              | Reason                                                                                                                    |
| -------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "7 direct OpenAI call sites" (audit §6)                   | **SUPERSEDED**      | Replaced by a single adapter. The enumeration in `docs/AI_PRIVACY_GATEWAY.md` §2 is the current record.                    |
| `ruDataResidencyBoundary.test.ts` (risk register §12)     | **SUPERSEDED**      | Delivered as `ai-boundary.spec.ts` — a broader provider-boundary scan. The RU-specific variant is meaningless until R8 exists. |
| "No privacy route exists" (R9 evidence)                   | **SUPERSEDED**      | The route now exists at `frontend/src/app/privacy/page.tsx`; the open issue moved to reachability (F2).                   |
| Migration application on deploy                           | **NOT APPLICABLE**  | Checked as a possible blocker: `backend/src/nest-app.ts:31` calls `runMigrations()`, which runs `prisma migrate deploy` at boot (`run-migrations.ts:51`). The consent migration will apply automatically. No action needed. |

---

## 3. PART 3 — U1–U12 console verification

**Rule observed throughout:** repository configuration is never treated as proof of console configuration where
a dashboard can override it.

Two blanket facts that apply to every row below:

- **Nothing in U1–U12 blocks a Russian *synthetic* demo.** A synthetic demo processes no personal data.
- **Every one of U1, U2, U3, U6, U7, U12 blocks setting `LEGAL_REVIEW_PENDING = false`**, because each fills a
  placeholder in the published policy.

---

### U1 — Render web service region

- **What needs verification:** which region runs the `liqvia2` web service.
- **Why it matters:** every request body, upload buffer and credential is processed there. It is the first fact
  any Russian customer or counsel will ask for.
- **Can the repo resolve it?** **No.** `render.yaml` declares no `region:` key.
- **Console:** Render dashboard.
- **Steps:** dashboard.render.com → **Services** → `liqvia2` → **Settings** → scroll to **Region**.
- **Report back:** the literal region string (e.g. `Oregon (US West)`), as a screenshot of the Settings panel.
- **Resolves:** Y1, processor table row 1, privacy policy §6 (`hosting-region`).
- **Blocks:** RU advertising ❌ · RU lead collection ❌ · RU synthetic demo ❌ · aggregated pilot ✅ (a pilot
  partner will ask) · real RU customer uploads ✅ · future RU deployment ✅.

### U2 — Render PostgreSQL region

- **What needs verification:** the region of the managed Postgres instance.
- **Why it matters:** all tenant financial data, user identities and RU leads live there.
- **Can the repo resolve it?** **Partially — new evidence.** The live connection string in `backend/.env`
  resolves to `dpg-d8ncrgi8qa3s73f08st0-a.oregon-postgres.render.com`. Render encodes the region in that
  hostname, so the database is in **Oregon (US-West)**. Confirm in console rather than rely on this alone.
- **Console:** Render dashboard.
- **Steps:** dashboard.render.com → **Databases** → select the instance → **Info** tab → **Region**. Confirm on
  the same screen whether the instance name matches `liqviadb` (note: `render.yaml` declares `liqvia2-db` /
  database `liqvia2`, but the live URL uses database `liqviadb` — **confirm which instance is actually serving
  production**, as this discrepancy suggests the blueprint is not the deployed truth).
- **Report back:** region string, instance name, database name, and the **plan tier** shown.
- **Resolves:** Y1, Y2, processor table row 2, privacy policy §6.
- **Blocks:** RU advertising ❌ · RU lead collection 🟡 (leads land here) · RU synthetic demo ❌ · aggregated
  pilot ✅ · real RU customer uploads ✅ · future RU deployment ✅.

### U3 — Backup schedule, retention and physical location

- **What needs verification:** whether backups exist, their cadence, retention, and the region they are stored in.
- **Why it matters:** a database in one jurisdiction with backups in another satisfies nothing.
- **Can the repo resolve it?** **No.** No backup tooling exists anywhere in the repository.
- **Console:** Render dashboard.
- **Steps:** **Databases** → your instance → **Backups** tab. Record cadence, retention window, and any region
  or bucket shown. If the tab reports the feature is unavailable on the current plan, **that is a valid and
  important answer** — record it verbatim.
- **Report back:** screenshot of the Backups tab.
- **Resolves:** Y2, privacy policy §6.
- **Blocks:** RU advertising ❌ · lead collection ❌ · synthetic demo ❌ · aggregated pilot 🟡 · real RU customer
  uploads ✅ · future RU deployment ✅.

### U4 — Point-in-time recovery

- **What needs verification:** PITR availability on the current plan, whether enabled, and the window.
- **Why it matters:** any stated RPO/RTO depends on it.
- **Can the repo resolve it?** **No** — and `render.yaml:5` (`plan: free`) is specifically *not* reliable here,
  because U2 already shows the deployed database does not match the blueprint's declared name.
- **Console:** Render dashboard → **Databases** → instance → **Recovery**.
- **Report back:** whether PITR is offered, whether it is on, and the retention window in days.
- **Resolves:** Y2.
- **Blocks:** nothing today. This blocks only customer contracts and security questionnaires that state an RPO.

### U5 — Log retention period and log storage region

- **What needs verification:** how long Render retains service logs and where.
- **Why it matters:** logs are a data store. Email addresses are masked from **today forward**
  (`log-redaction.ts`), but entries written before that change still contain them.
- **Can the repo resolve it?** **No.**
- **Console:** Render dashboard → **Services** → `liqvia2` → **Logs**; then the plan's documented retention.
- **Report back:** retention period in days, and whether any log drain/export to a third party is configured
  (**Settings → Log Streams**).
- **Follow-up:** if historic logs are still within retention, decide whether to request early expiry.
- **Resolves:** Y3 (residual), processor table row 3.
- **Blocks:** nothing operationally. Relevant to a data-subject erasure request.

### U6 — SMTP provider identity and region

- **What needs verification:** which SMTP provider is configured and where it processes mail.
- **Why it matters:** an unidentified processor currently receives user email addresses and password-reset links.
  It cannot be named in privacy policy §5 until it is known.
- **Can the repo resolve it?** **No** — `sync: false` in `render.yaml:37-43`.
- **Console:** Render dashboard → **Services** → `liqvia2` → **Environment**.
- **Steps:** read the value of `SMTP_HOST` (and `SMTP_FROM`). **Do not paste `SMTP_PASS` anywhere.**
- **Report back:** the `SMTP_HOST` value only (e.g. `smtp.sendgrid.net`).
- **Resolves:** Y4, privacy policy §5 (processor list).
- **Blocks:** RU advertising ❌ · lead collection ❌ · synthetic demo ❌ · aggregated pilot ❌ · real RU customer
  uploads 🟡 · publishing the policy ✅.

### U7 — OpenAI data-processing terms in force

- **What needs verification:** API retention window, training opt-out status, ZDR eligibility, whether a DPA is signed.
- **Why it matters:** governs what happens to everything the gateway sends. After Phases 1–2 only aggregated
  non-identifying metrics leave the product, which lowers the stakes considerably — but privacy policy §4
  asserts a cross-border transfer basis that cannot be written without these facts.
- **Can the repo resolve it?** **No.**
- **Console:** platform.openai.com → **Settings** → **Organization** → **Data controls**; then **Legal**.
- **Report back:** the retention setting shown, whether "improve the model for everyone" is off, and whether a
  DPA/ZDR agreement is listed as executed.
- **Resolves:** privacy policy §4 (`ai-processor-terms`).
- **Blocks:** RU advertising ❌ · lead collection ❌ · synthetic demo ❌ · aggregated pilot 🟡 · real RU customer
  uploads ✅ · publishing the policy ✅.

### U8 — Yandex Metrica Webvisor and sensitive-field behaviour

Covered in full in Part 4 below, including the exact console procedure and the screenshots required.

### U9 — Metrica data-sharing and offline-conversion settings

- **What needs verification:** whether data sharing with other Yandex services is on, and whether offline
  conversions or CRM uploads are configured.
- **Why it matters:** determines the true scope of Yandex processing beyond page analytics.
- **Can the repo resolve it?** **No** — these are console-only settings with no code representation.
- **Console:** metrika.yandex.ru → counter `111417446` → **Настройки / Settings** → **Основные / General**.
- **Steps:** look for «Отправка данных в Яндекс» / data-sharing toggles, and check
  **Настройки → Загрузка данных / Offline conversions** for any uploaded CRM file.
- **Report back:** screenshot of the General settings page, plus confirmation that the offline-conversions list
  is empty.
- **Resolves:** processor table row 5, privacy policy §5.
- **Blocks:** RU advertising 🟡 (verify before scaling spend) · lead collection ❌ · everything else ❌.

### U10 — CDN in front of the domains

- **What needs verification:** whether Cloudflare or any proxy sits in front of `liqvia.org` / `liqvia.info`.
- **Why it matters:** a CDN is an undocumented processor that terminates TLS and sees every request.
- **Can the repo resolve it?** **No**, but it is verifiable from your machine without a console:

```bash
dig +short NS liqvia.info && dig +short liqvia.info && dig +short NS liqvia.org && dig +short liqvia.org
```

- **Report back:** the raw output. Nameservers containing `cloudflare`, or A-records in Cloudflare ranges,
  answer it immediately.
- **Resolves:** processor table completeness, privacy policy §6.
- **Blocks:** lead collection 🟡 · publishing the policy ✅ · everything else ❌.

### U11 — Has production data ever been copied to a developer machine?

- **Status change: this is now partially ANSWERED, and the answer is yes.**
- **Repository evidence:** `backend/.env` holds live production credentials on this laptop (F1), and the test
  suite writes through them. `qa/ok-bankrot/` holds a real client's re-identification key and financial files
  (F3).
- **What still needs a human:** whether a `pg_dump` or export was ever taken; by whom; when; and whether copies
  still exist on any machine or in any backup.
- **Where:** interview everyone holding Render credentials. There is no technical log to consult — see U5.
- **Report back:** a written statement per credential-holder.
- **Mitigation already available:** `pnpm --filter @liqvia2/backend run prisma:seed:demo` produces a complete
  synthetic dataset, so there is no technical need for production data locally.
- **Blocks:** RU advertising ❌ · lead collection ❌ · synthetic demo ❌ · aggregated pilot ✅ · real RU customer
  uploads ✅ · future RU deployment ✅.

### U12 — Registrar, hosting arrangement and legal entity for `liqvia.info`

- **What needs verification:** which registrar holds the domain, under which legal entity, and which entity
  operates the site.
- **Why it matters:** data-protection obligations attach to the operating entity, not the codebase. This is the
  single hardest blocker on the privacy policy — §1 cannot be written without it, and §1 is the first thing a
  regulator reads.
- **Can the repo resolve it?** **No.** No corporate identity appears anywhere in the codebase.
- **Where:** your registrar account (and `whois liqvia.info` for the registrar name), plus corporate records.
  `Liqvia_Funding_Residency_Roadmap.docx` §Phase 0 indicates the Australian Pty Ltd may not yet be incorporated
  — if so, **that is the answer**, and it is decisive.
- **Report back:** registrar name; registrant entity; whether an operating company exists yet and in which
  jurisdiction.
- **Resolves:** privacy policy §1 (`controller-identity`), §10 (`contact-details`).
- **Blocks:** RU advertising ✅ · RU lead collection ✅ · synthetic demo ❌ · aggregated pilot ✅ · real RU
  customer uploads ✅ · future RU deployment ✅.

### Blocking summary

| Blocked item                                       | Blocked by                                 |
| -------------------------------------------------- | ------------------------------------------ |
| Any customer-facing statement about hosting region | U1, U2                                     |
| Any statement about backups, DR, RPO or RTO        | U3, U4                                     |
| Privacy policy §1 (controller identity)            | **U12**                                    |
| Privacy policy §5 (processor list — SMTP)          | U6                                         |
| Privacy policy §6 (where data is stored)           | U1, U2, U3, U10                            |
| Privacy policy §4 (AI processor terms)             | U7                                         |
| Setting `LEGAL_REVIEW_PENDING = false`             | U1, U2, U3, U6, U7, U12 + counsel sign-off |
| Any claim the lead form does not leak PII to Yandex | **U8**                                    |

---

## 4. PART 4 — Yandex Metrica / Webvisor

**Framing:** Metrica is intentionally deployed for the Russian landing page. Nothing below recommends removing
it or disabling Webvisor. This is verification.

### 4.1 What the repository establishes

| Question                                     | Repository answer                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Which domains load Metrica?**               | Exactly three hosts: `liqvia.info`, `www.liqvia.info`, and — via CSP/middleware — `liqvia-landing.onrender.com`. Gate at `yandex-metrica.tsx:7,13`, a `hostname` check that returns early on any other host. The authenticated product domain never loads it. |
| **Which page?**                               | Only `/cash-operating-system` (`frontend/src/app/cash-operating-system/page.tsx:86`). It is not in the root layout.                                        |
| **Counter ID**                                | `111417446` (`yandex-metrica.tsx:6`, `cash-os/analytics.ts:35`), overridable via `NEXT_PUBLIC_YANDEX_METRICA_ID`.                                          |
| **Is it host-gated?**                         | **Yes**, and correctly — the guard runs before the `tag.js` script element is created, so no request is made off-host.                                     |
| **Any other analytics?**                      | **No.** Grep for `gtag`, `googletagmanager`, `google-analytics`, `fbq`, `hotjar`, `clarity`, `linkedin`, `pixel`, `amplitude`, `mixpanel`, `posthog`, `segment` across `frontend/src`, `frontend/server-dist` and `backend/src` returns only Yandex matches. G5 holds. |
| **Is Webvisor configured in code?**           | **No.** `ym(id, 'init', {...})` passes `ssr`, `clickmap`, `accurateTrackBounce`, `trackLinks` — and no `webvisor` key (`yandex-metrica.tsx:24-29`).        |
| **Is sensitive-field masking visible in code?** | **No — and this is the actionable repo-side gap.** The lead form has no `ym-hide-content` class, no `ym-record-keys`/`ym-disable-keys` attribute, and no masking wrapper on any input. All seven fields (`name`, `companyName`, `email`, `phone`, `employeeCount`, `industry`, `comment`) render as plain inputs (`lead-form.tsx:121-193`). |
| **Does consent control Metrica?**             | **No.** `yandex-metrica.tsx:12-37` initialises on mount. `frontend/src/lib/consent.ts` re-exports wording constants only. The checkbox governs lead submission, not analytics. There is no cookie banner. This is Y6, still open. |
| **Do goals carry PII?**                       | **No.** `trackCtaEvent` sends only a fixed enum string via `reachGoal` (`cash-os/analytics.ts:12-22,32-37`). `form_submit` fires after a successful POST and carries no field values. |
| **Does CSP permit Webvisor?**                 | **Yes.** `middleware.ts:34-35` allows `script-src` and `connect-src` to all 18 `mc.yandex.*` origins. If Webvisor is enabled server-side, the recorder will load and transmit. |

### 4.2 What cannot be established from code

The `init` options are **not** the authority. Metrica's counter settings are server-side: the tag fetches its
configuration and enables Webvisor if the console says so, regardless of the flags passed at `init`. Therefore
the following are **unknowable from this repository** and must be read from the console:

1. Whether Webvisor is ON.
2. Whether form-content recording is ON.
3. Whether Metrica's default field masking applies, or only to explicitly marked fields.
4. Whether keystroke recording is enabled.
5. Whether data sharing / offline conversions are configured (U9).

### 4.3 Exact console verification procedure — U8

Open **metrika.yandex.ru**, sign in, and select counter **111417446**.

**Screen 1 — Webvisor settings**

1. Left sidebar → **Настройки** (Settings).
2. Open the **Вебвизор** (Webvisor) tab.
3. Record the master toggle: **«Вебвизор, карта скроллинга, аналитика форм»** — ON or OFF.

→ **Send: a full screenshot of this tab.**

**Screen 2 — form and field recording (only if Webvisor is ON)**

On the same Webvisor tab, record the state of each of:

| Setting (RU)                                    | English                                       | Report |
| ------------------------------------------------ | --------------------------------------------- | ------ |
| «Записывать содержимое полей форм»                | Record form field contents                    | ON/OFF |
| «Записывать только по маске» / content-hiding mode | Record only marked / hide only marked          | which mode |
| «Запись нажатий клавиш»                           | Keystroke recording                            | ON/OFF |
| Webvisor version (2.0 / 1.0)                      | —                                             | which |

→ **Send: a screenshot showing all of these together.**

**Screen 3 — an actual session recording (the only conclusive test)**

Settings screens describe intent; a recording shows behaviour.

1. On a device you control, open `https://liqvia.info`, scroll to the form, and type **clearly fake** values
   into every field — e.g. name `TESTNAME ZZZ`, company `TESTCO ZZZ`, email `test-zzz@example.com`, phone
   `+7 000 000 00 00`, comment `TESTCOMMENT ZZZ`. **Do not submit.**
2. Wait ~15 minutes for the recording to appear.
3. Metrica → **Вебвизор** → find that session → play it → scrub to the form interaction.
4. Observe whether the typed characters appear, appear as dots/asterisks, or the fields stay blank.

→ **Send: a screenshot of the playback at the moment the form is filled.**

**Screen 4 — form analytics**

Metrica → **Отчёты → Аналитика форм** (Reports → Form analytics). Confirm whether any report exists for the
lead form and whether it exposes entered values as opposed to interaction counts only.

→ **Send: a screenshot.**

### 4.4 How the answer will be used

| Console result                                          | Verdict for U8                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Webvisor **OFF**                                         | **U8 CLOSED — VERIFIED SAFE.** Record the date and who verified.       |
| Webvisor **ON**, form contents **OFF**, playback shows masked/blank fields | **U8 CLOSED — VERIFIED SAFE**, conditional on adding the defence-in-depth markup below and re-verifying after any Metrica settings change. |
| Webvisor **ON** and any typed value visible in playback  | **ESCALATE.** Yandex is receiving lead PII. Two fixes, either order: turn form-content recording off in the console, and mark the form in code. |

### 4.5 Repository-side recommendation (independent of the console answer)

Whatever the console says today, a console setting can be changed by anyone with account access and leaves no
trace in the codebase. The form should carry its own protection so that the safe state does not depend on a
remembered dashboard toggle:

- add `ym-hide-content` to the `<form>` element in `lead-form.tsx:117`;
- add `ym-disable-keys` to the free-text `comment` textarea and the identity inputs.

This is a markup-only change with no behavioural effect on the product or on Metrica's traffic, conversion and
click-map reporting. **It is a recommendation, not something implemented in this task** — no code was changed
during this audit.

---

## 5. PART 5 — R5: `UploadBatch.rowSnapshot`

### 5.1 What it is

| Question                                    | Answer                                                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **What data does it store?**                 | `validation.rows` — the complete parsed row set of the uploaded file, every column, verbatim (`upload-import.service.ts:93`). Typed `Json?` at `schema.prisma:567`.                                                                          |
| **Can it contain personal data?**            | **Yes, certainly.** The template headers are `Customer Name`, `Supplier Name`, `Bank Account Name`, `Account Number Masked`, `Description` — confirmed from the live QA files under `qa/ok-bankrot/`. For Russian customers, `Description` and `Supplier Name` will in practice carry employee names and salaries (this is Y9). |
| **When is it created?**                      | On successful import only. The batch is created with `status: importing` and no snapshot (`:69-77`); the snapshot is written in the same update that sets `status: completed` (`:89-95`). A failed import stores no snapshot (`:106-109`).   |
| **Which features read it?**                  | Three, all in `upload-import.service.ts`: (1) `listBatches` reads it solely to compute a `hasSnapshot` boolean and **strips it from the response** (`:135-141`); (2) `getBatch` returns the full rows to the client (`:151-161`); (3) `deleteBatch` restores the previous snapshot as live data (`:242-264`). |
| **Is it required for…**                      | **Rollback/restore — yes, load-bearing.** Deleting the active import clears live data and re-persists the previous batch's rows (`:239-264`). Without the snapshot this silently becomes data loss. **Import review — yes**, `GET /uploads/batches/:id` is the only way to see what was imported. **Validation — no** (validation happens pre-persist). **Reconciliation / duplicate detection / audit trail — no**, none of these read it; the audit trail is `AuditLog`, which stores `templateType` and `rowCount` only (`:96-104`). **Troubleshooting — informally yes**, it is the only record of the original file. |
| **Can users access it?**                     | **Yes**, and correctly scoped: `GET /uploads/batches/:id`, `@UseGuards(WorkspaceGuard)`, `@Permissions('uploads:read')`, `companyId` taken from the JWT and used as a query filter (`upload.controller.ts:248-251`). No cross-tenant read path exists.                          |
| **Can developers/admins access it?**         | **Yes — directly, via the production connection string.** See F1. There is no bastion, IP allowlist or read-only role.                                                                                                                       |
| **Is it ever sent to AI?**                   | **No.** `grep -rn "rowSnapshot"` across `backend`, `frontend`, `packages` returns eight hits, all in `schema.prisma` and `upload-import.service.ts`. `ai-upload.service.ts` and the gateway never touch it, and raw rows are prohibited by the payload allowlist regardless. |
| **Does it appear in logs?**                  | **No.** No logger call references it; the audit-log metadata is `{ templateType, rowCount }`.                                                                                                                                                |
| **How long does it remain?**                 | **Indefinitely.** No TTL, no expiry field, no pruning job. `listBatches` caps the *response* at 50 rows (`:127`), which hides growth without limiting it.                                                                                     |
| **Does deleting the upload remove it?**      | **Yes.** `uploadBatch.delete` removes the row and its snapshot (`:269`), and `UploadBatch.company` is `onDelete: Cascade` (`schema.prisma:572`), so deleting a company removes every snapshot with it.                                        |

### 5.2 Recommendation

**KEEP WITH RETENTION PERIOD.**

Reasoning: the field is genuinely load-bearing. `deleteBatch` is a user-facing rollback that restores the
previous version of the data; removing or emptying the snapshot converts that feature into silent data loss.
`REMOVE COMPLETELY` and `DELETE AFTER IMPORT` are therefore both wrong. `REDUCE STORED FIELDS` would break
restore fidelity, since the restore path re-persists exactly what was stored. `REPLACE WITH STRUCTURED
SNAPSHOT` is redundant — the rows are already structured objects, and the identifying columns are precisely
the ones restore needs.

The real defect is unbounded time, not existence. The proportionate change is to null the `rowSnapshot` of
batches older than a defined window (90 days is a reasonable starting point — long enough that rollback stays
useful, short enough to bound exposure), leaving `hasSnapshot: false` and the batch metadata intact. The
restore path already handles a missing snapshot gracefully: `deleteBatch` filters on
`rowSnapshot: { not: Prisma.DbNull }` (`:248`) and skips restore when `previousRows.length === 0` (`:254`).

Not implemented in this task, per the instruction to understand consequences first.

---

## 6. PART 9 + PART 10 — AI Privacy Gateway re-test and quality regression

### 6.1 Verification results

| Requirement                                              | Result | Evidence                                                                                                                                                       |
| --------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every external AI call passes through the gateway         | ✅     | Repo-wide grep for `fetch(`, `axios`, and any `https?://` literal across `backend/src`: **two hits, both `openai.provider.ts:18,67`.** One outbound HTTP call exists in the entire backend. |
| Only the gateway may import OpenAI                        | ✅     | `ai-gateway.module.ts:11` registers `OpenAiProvider` as a provider but does not export it; `index.ts` exports the service only, asserted by `ai-boundary.spec.ts:115-119`. |
| CI/lint boundary works                                    | ✅     | `eslint.config.mjs:40-66` — `no-restricted-imports` for 9 provider SDKs plus a pattern blocking `**/ai-gateway/providers/*`, and `no-restricted-syntax` matching `api.openai.com` in both `Literal` and `TemplateElement` nodes, plus Anthropic/Google/Mistral/Cohere. `ai-boundary.spec.ts` performs the same check by filesystem scan, which cannot be suppressed with an inline comment, and guards against scanning zero files (`:71-75`). All 5 boundary tests pass. |
| Raw PDFs cannot reach OpenAI                              | ✅     | Call site deleted (`ai-upload.service.ts:234`), no `fetch` remains in the file, and `pdfText` is not a schema key.                                              |
| Raw uploaded rows cannot reach OpenAI                     | ✅     | Call site deleted (`:304`); `aiPayloadSchema` is `.strict()` with no rows field.                                                                                 |
| Bank narratives cannot reach OpenAI                       | ✅     | `decision-quality.spec.ts` — "carries no narrative text at all" passes. Payload probe below shows `cashFlowCategories` aggregates only.                          |
| Personal names transformed/blocked                        | ✅     | Probe: `Ivan Petrov` → `CUSTOMER_C898`, `Critical Supply` → `SUPPLIER_S341`. `redaction.spec.ts` — "emits codes that contain no part of the original name" passes. |
| Emails blocked                                            | ✅     | Probe: `ivan@acme.ru` → `[EMAIL]`.                                                                                                                              |
| Phones blocked                                            | ✅     | Probe: `+7 916 123 45 67` → `[PHONE]`.                                                                                                                          |
| Account numbers blocked                                   | ✅     | `redaction.spec.ts` covers RU 20-digit settlement accounts, IBANs and card numbers — all pass.                                                                   |
| Free-text sanitisation works                              | ✅     | Probe output: `"CUSTOMER_C898 owes us a lot — call him on [PHONE] or [EMAIL]. Can we cover payroll?"` — 1 000-char cap and truncation covered by tests.          |
| Structured codes preserve decision quality                | ✅     | 19 `decision-quality.spec.ts` tests pass; see §6.3.                                                                                                             |
| `AiInsight.context` no longer stores the original context | ✅     | `ai.service.ts:529-568` — audit object only.                                                                                                                    |
| `payloadDigest` behaviour                                 | ✅     | `ai.service.ts:536` — `payload ? digestPayload(payload) : null`, so a rule-based fallback correctly records `null` rather than a digest of nothing.              |

**Search for escaped call sites.** Grepped `openai`, `OpenAI`, `chat.completions`, `responses.create`,
`completions`, `api.openai`, plus `anthropic`, `gemini`, `generative-ai`, `mistral`, `cohere`, `ollama`,
`huggingface`, `replicate`, `deepseek`, `yandexgpt`, `gigachat`, `sber` across `backend/src`, `frontend/src`,
`packages`, `eslint.config.mjs` and `render.yaml`. **No alternative direct call exists.** All remaining matches
are the provider adapter itself, the boundary test, TypeScript union types `'openai' | 'rule_based'`, UI
attribution strings in the four locale files, and the privacy policy naming OpenAI as a processor.

**Test result:** `npx jest src/ai-gateway --verbose` → **4 suites, 78 tests, all passing, 0.958 s.**

### 6.2 Fail-closed behaviour, verified by reading the path

`AiPrivacyGatewayService.validate()` runs two independent checks — `aiPayloadSchema.safeParse` then
`findProhibitedKeys` — and throws `AiPayloadRejectedError` before any network call
(`ai-privacy-gateway.service.ts:130-151`). `ai.service.ts:501-515` catches it, logs it as a **Liqvia defect**
with field paths only and no values, and serves the deterministic rule-based answer with
`model: 'rule-based-fallback:payload-rejected'`. A rejected payload cannot reach the provider.

### 6.3 Quality regression — classification: **NO MATERIAL DEGRADATION**

Method: synthetic data only. A temporary probe built the exact payload the gateway would transmit for a
synthetic Russian-currency company (three receivables, two payables, a payroll obligation, four bank
transactions, and a free-text question containing a name, a phone number and an email). The probe was deleted
after the run. No real customer data was used anywhere.

The transmitted payload carried, per receivable: `counterpartyCode`, `amount`, `dueWeek`, `daysOverdue`,
`status`, `shareOfTotalPct`, `collectionConfidence`, `cashImpact` — eight distinct decision signals.

| Capability                       | Verdict | Evidence from the transmitted payload                                                                                  |
| -------------------------------- | :-----: | ------------------------------------------------------------------------------------------------------------------------ |
| AI CFO responses                 | ✅      | Question redacted to `CUSTOMER_C898 owes us a lot … Can we cover payroll?` — **the same code appears in `receivables.items`**, so the model can still connect the question to the specific invoice. |
| Business Pulse                   | ✅      | `liquidity` block carries `openingCash`, `week13ClosingCash`, `runwayWeeks`, `weeklyBurn`, `liquidityStatus`.            |
| Liquidity explanations           | ✅      | Same block; `dataCoverage` lets the model qualify its own confidence.                                                    |
| Critical receivable ID           | ✅      | The 2 400 000 overdue item is `cashImpact: "CRITICAL"`, `shareOfTotalPct: 76.92`, `collectionConfidence: 0.75`; the 120 000 current item is `LOW`. The 123-day item drops to `collectionConfidence: 0.2`. |
| Critical payable ID              | ✅      | `SUPPLIER_S341` — `priority: "critical"`, `cashImpact: "HIGH"`, `shareOfTotalPct: 98.36`; `SUPPLIER_S025` — `non_essential`, `LOW`. |
| Scenario reasoning               | ✅      | `scenario` block carries baseline/scenario/delta plus `assumptions[]` when a scenario is supplied.                        |
| Cash-driver explanations         | 🟡      | `cashFlowCategories` preserved direction, total, count and average per category. See the one caveat below.                |
| Confidence explanations          | ✅      | Per-obligation `confidence: "high"`, plus `dataQuality` and `dataCoverage`.                                              |

**The one caveat (MINOR, and not a regression against the old payload).** In the probe, the payroll category
returned `cadenceDays: null` and `isRecurring: false` despite two monthly salary runs, because cadence
inference needs at least three observations. Previously the model saw raw narratives (`SALARY RUN JANUARY`,
`SALARY RUN FEBRUARY`) and could infer monthly cadence from two. With real customer histories — where a payroll
series has many more than three entries — the aggregate detects the cadence correctly, which is exactly what
`decision-quality.spec.ts` "turns repeated payroll narratives into a recurring category with a cadence"
asserts and passes. The gap appears only on very thin data, and the separate `obligations[]` block carries
`frequency: "monthly"` explicitly, so the signal is not actually lost.

**Recommendation: change nothing.** Do not weaken any control to improve wording.

---

## 7. PART 6 — Y7: production data access

### Who can currently access production data, and how

| Vector                          | State today                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Render database access**      | Anyone with Render dashboard credentials. Render exposes the external connection string in the UI.                                        |
| **Database connection strings** | `backend/.env` on this laptop holds the live production URL with an embedded password. Gitignored (`.gitignore:15`) and confirmed untracked — so it is not in git history, but it is in plaintext on disk. |
| **Admin tools**                 | None. No admin UI, no impersonation endpoint. Every data endpoint derives `companyId` from the JWT and filters on it (`WorkspaceGuard` + `@Permissions`). **This is a genuine strength.** |
| **Prisma access**               | `pnpm --filter @liqvia2/backend prisma:studio` opens a full read/write GUI over production with the `.env` credentials. |
| **Manual SQL access**           | Unrestricted — an ordinary Postgres connection string, no bastion, no IP allowlist, no read-only role. `psql` is not installed on this machine, but nothing prevents installing it. |
| **Exports**                     | No bulk-export endpoint exists in the application. `GET /uploads/batches/:id` returns one batch's rows and is tenant-scoped. |
| **Backups**                     | Unknown — U3. Whoever can restore a backup can read everything in it. |
| **Application download endpoints** | Tenant-scoped only; nothing crosses companies. |
| **Developer access**            | Effectively unlimited and indistinguishable from application access at the database layer. |
| **Local database copies**       | **Confirmed present in a related form** — `qa/ok-bankrot/` holds a real client's financial files and re-identification key (F3). Whether a full `pg_dump` was ever taken is U11. |
| **Production dumps**            | Nothing prevents one. No log would record it. |

### Direct answers

- **Who can access production data?** Everyone holding Render credentials, plus anyone with a copy of
  `backend/.env`. There is no separation between "can deploy" and "can read every customer's financials".
- **How?** Directly, with the connection string — `prisma studio`, any SQL client, or an ad-hoc script. The
  test suite does it as a side effect (F1).
- **Is access logged?** **No.** `AuditLog` records application-level *writes* (`upload.import`,
  `upload.clear_active`). Direct database access is invisible to it, and Render's own Postgres logging is
  unverified (U5). This is Y11 restated with the correct scope.
- **Can production data be downloaded to a developer laptop?** **Yes, trivially — and it already has been**, in
  the QA-file form (F3) and via the test suite (F1).
- **Are there role restrictions?** Inside the application, **yes and they are well built**: `WorkspaceGuard` +
  `@Permissions('uploads:read'|'uploads:write')` + `companyId` from the JWT on every query. At the **database**
  layer, **none** — one superuser-equivalent role.
- **Is there any legitimate operational need?** For reading production data locally, **no**. A complete
  synthetic seed already exists (`prisma:seed:demo`). The only genuine need is incident diagnosis, which does
  not require a bulk copy.

### Minimum proportionate control for Liqvia's current stage

No enterprise tooling. Four changes, none of which need new infrastructure:

1. **Point local development at a local database.** Replace `DATABASE_URL` in `backend/.env` with a local
   Postgres and seed it with `prisma:seed:demo`. This alone removes the F1 test-writes-to-production failure
   mode. *(See Part 11 for the smallest safe way to stand one up.)*
2. **Fail the test suite closed.** Have `backend/src/load-env.ts` — or a Jest global setup — refuse to run when
   `DATABASE_URL` points at a non-local host. Three lines, and it makes the F1 accident structurally impossible.
3. **Add `qa/` to `.gitignore`** and move `qa/ok-bankrot/` out of the repository tree into encrypted storage.
4. **Create a read-only Postgres role** for diagnosis, and keep the read/write credential for the deployed
   service only. Render supports additional roles on paid plans; if the current plan does not, record that as
   the reason and revisit at upgrade.

A one-page written rule — *no production data on developer machines; use the synthetic seed* — should accompany
these. It is the cheapest item on this list and the one Y7 originally asked for.

---

## 8. PART 7 — privacy policy

### Technical issues

| Check                           | Result                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Does the route work?**        | **Partially. This is the blocker.** `200` on the application host; **`307` → `/` on `liqvia.info`** (F2, verified by command output). The page itself renders correctly. |
| **Do all links resolve?**       | The outbound link `→ Cash Operating System` (`page.tsx:40`) resolves. The two **inbound** links — consent checkbox (`lead-form.tsx:216-222`) and footer (`footer.tsx:19-20`) — both point at `/privacy` and are therefore **both broken on the landing domain**. |
| **Is it indexed?**              | **No, correctly.** `metadata.robots = { index: false, follow: false }` (`page.tsx:9`). There is no `robots.txt` or `sitemap.ts` in the repository, so the meta tag is the sole control — sufficient while the page is a draft. |
| **Is `LEGAL_REVIEW_PENDING` still enabled?** | **Yes.** `page.tsx:18` — `const LEGAL_REVIEW_PENDING = true`. The bilingual amber draft banner renders (`:52-68`). **Not removed, and not to be removed** until counsel signs off. |

### Unresolved placeholders

Seven `<LegalReview>` blocks, each with a stable `data-legal-review` id:

| id                         | §  | What is missing                                                              | Also blocked by |
| -------------------------- | -- | ---------------------------------------------------------------------------- | --------------- |
| `controller-identity` / `-en` | 1  | Legal entity name, registration number, registered address, contact details | **U12**         |
| `lawful-basis`             | 3  | Lawful bases under applicable law, including cross-border transfer            | —               |
| `ai-processor-terms`       | 4  | OpenAI terms in force: retention, training opt-out, transfer mechanism        | **U7**          |
| `hosting-region`           | 6  | Service and database region, backup location and retention                   | **U1, U2, U3**  |
| `retention-periods`        | 7  | Retention per category: leads, accounts, uploaded data, logs, consent records | —               |
| `data-subject-rights`      | 8  | Rights available and how to exercise them, including consent withdrawal       | —               |
| `contact-details`          | 10 | Data-protection contact and, where applicable, representative                 | **U12**         |

### Statements requiring legal confirmation (factually verified, legally unconfirmed)

These are **technically accurate** — I re-verified each against source today — but whether they are *sufficient*
or *correctly characterised* under the applicable law is counsel's call:

- §2: "Персональные данные из журналов удаляются (адреса электронной почты маскируются)." True going forward
  (`log-redaction.ts`), but **historic log entries predating the change may still contain addresses** (U5). The
  present tense may overstate the position.
- §4: "Наружу передаются только агрегированные обезличенные финансовые показатели." Technically accurate. Whether
  pseudonymous codes plus exact amounts constitute *обезличенные* (anonymised) rather than *псевдонимизированные*
  data under the applicable law is a **legal characterisation**, and the distinction matters.
- §5: the processor list is complete against the code, but the SMTP entry names no provider (U6).
- §9: the consent-record description matches the implementation exactly (§9 of this report).

### Classification

| Issue                                                      | Type                            |
| ---------------------------------------------------------- | ------------------------------- |
| `/privacy` 307s on `liqvia.info`                            | **TECHNICAL** — P0              |
| Both inbound links unreachable from the landing domain      | **TECHNICAL** — same root cause |
| `robots: index:false` while in draft                        | **TECHNICAL** — correct as-is   |
| Seven `LegalReview` placeholders                            | **LEGAL WORDING/BASIS**         |
| §2 log-masking statement vs. historic logs                  | **TECHNICAL fact → LEGAL wording** |
| §4 anonymised vs pseudonymised characterisation             | **LEGAL BASIS**                 |
| `LEGAL_REVIEW_PENDING = false`                              | **LEGAL** — needs U1, U2, U3, U6, U7, U12 + sign-off |

No legal conclusions are drawn here, and the legal-review warning has not been touched.

---

## 9. PART 8 — consent

### Technical consent evidence: **IMPLEMENTED**

| Behaviour                              | Result | Evidence                                                                                                                                     |
| -------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkbox behaviour                     | ✅     | `lead-form.tsx:203-224` — unticked by default, `required`, not pre-checked.                                                                   |
| Consent required before submission     | ✅     | Enforced three times: `required` on the input; `disabled={… \|\| !consentGiven}` on the submit button (`:228`); and server-side rejection with `BadRequestException('Consent acknowledgement is required')` (`cash-os-leads.service.ts:31-33`). The server check is the one that matters, and it is present. |
| `ConsentRecord` creation               | ✅     | `consent.service.ts:74-87`; model at `schema.prisma:791+`; migration `20260809120000_consent_records/migration.sql` applied automatically at boot via `nest-app.ts:31`. |
| Timestamp                              | ✅     | Captured when the **box is ticked**, not at submit (`lead-form.tsx:51,210`). Client clocks are distrusted: `resolveAcknowledgedAt` falls back to server time when skew exceeds one hour (`consent.service.ts:90-99`). |
| Wording version                        | ✅     | `subjectId` + `version` + `policyVersion` + `locale` stored. The displayed sentence comes from the same shared registry that is submitted (`lead-form.tsx:6,215`), and the server re-verifies it against `packages/shared/src/consent.ts` whitespace-insensitively, storing `consentText` + `consentTextSha256` + `textVerified` (`consent.service.ts:53-81`). An unknown `subjectId@version` is rejected outright. |
| Transaction linkage                    | ✅     | Single `prisma.$transaction` writes lead then consent record with `cashOsLeadId` (`cash-os-leads.service.ts:37-61`); FK is `ON DELETE CASCADE`. |
| Behaviour if lead creation fails       | ✅     | Transaction aborts; neither row exists.                                                                                                       |
| Behaviour if consent creation fails    | ✅     | Transaction aborts; **the lead is rolled back too.** A lead can never exist without its evidence. |
| Duplicate submissions                  | 🟡     | No idempotency key or unique constraint. Resubmitting creates a second lead **and** a second consent record — consistent, not corrupt, but the leads table will contain duplicates. Cosmetic at current volume. |
| Existing historical leads              | ⚠️     | Any `CashOsLead` created before this migration has **no** `ConsentRecord`. `consentRecords` is an optional relation, so they are legal in the schema but carry no evidence. Query `SELECT count(*) FROM "CashOsLead" l LEFT JOIN "ConsentRecord" c ON c."cashOsLeadId" = l.id WHERE c.id IS NULL;` to size this. If any exist, they cannot be retro-fitted — that is a legal question, not a technical one. |

Design note worth recording: storing the wording itself rather than a boolean means a later copy change cannot
retroactively alter what a past user is recorded as having agreed to. That is the right shape for this.

### Legal validity of consent: **COUNSEL QUESTION — and currently at risk on a technical ground**

The technical evidence above proves *that* a specific sentence was displayed and acknowledged at a specific
time. It does not prove the consent is **valid**. Separately from wording, there is a technical fact that
counsel needs to know: **on `liqvia.info`, the privacy policy referenced in the consent sentence cannot be
opened** (F2). Whether an acknowledgement of a notice pointing to an unreachable policy is valid consent is
a legal question — but the underlying defect is a one-line code fix, and fixing it removes the question
entirely. **Fix F2 before collecting any lead.**

Also for counsel: whether consent is the correct lawful basis at all (`lawful-basis`, §3 of the policy);
whether a Russian data subject requires additional or differently-worded consent; and whether the absence of a
withdrawal mechanism (Y10 — no erasure path exists) undermines validity.

---

## 10. PART 11 — test suite and lint

### Test results — `pnpm --filter @liqvia2/backend test`

```
Test Suites: 3 failed, 25 passed, 28 total
Tests:       4 failed, 251 passed, 255 total
```

Failures classified by re-running the same specs against a clean `git worktree` of HEAD (`78ad445`), i.e.
**without** any Phase 0–2 work:

| Failure                                                                       | Classification            | Evidence                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `budget.service.spec.ts` — "computes variance via KPI service": expected `10000`, received `-10000` | **PRE-EXISTING FAILURE**  | Reproduced identically on the clean HEAD worktree. Neither `budget.service.ts` nor its spec is modified in the working tree. **A sign convention disagreement between the KPI service and the spec — worth a look on its own merits, since budget variance is user-facing.** |
| `upload-validation.integration.spec.ts` — "accepts valid budget sample"        | **PRE-EXISTING FAILURE**  | Reproduced identically on the clean HEAD worktree.                                                                                                            |
| `upload-import.service.spec.ts` — "deletes latest upload and restores the previous snapshot" | **ENVIRONMENT-DEPENDENT** | 5 s Jest timeout awaiting a remote Postgres round-trip. Suite took 23.7 s.                                                                                     |
| `upload-import.service.spec.ts` — "deletes the latest upload and rolls back to the prior version" | **ENVIRONMENT-DEPENDENT** | Same.                                                                                                                                                          |

**NEW REGRESSIONS: none.** No failure is attributable to Phases 0–2. The only Phase 0–2 change to `packages/shared`
is one additive line (`export * from './consent';`).

**All 78 AI-gateway tests pass** across 4 suites in under a second.

> The two environment-dependent failures are the F1 finding in disguise: they are slow because they are talking
> to a remote production database, not because they are wrong.

### Smallest safe way to run the Postgres-dependent tests properly

Docker is available on this machine. Nothing else needs installing.

```bash
docker run --rm -d --name liqvia-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=liqvia_test -p 5433:5432 postgres:16
```

Then create `backend/.env.local` — already gitignored (`.gitignore:16`) and already loaded with `override: true`
by `load-env.ts:34-37`, so it takes precedence over `.env` without editing it:

```
DATABASE_URL=postgresql://postgres:test@localhost:5433/liqvia_test
```

Apply the schema and seed synthetic data:

```bash
pnpm --filter @liqvia2/backend exec prisma migrate deploy && pnpm --filter @liqvia2/backend run prisma:seed:demo
```

Two notes. The upload-import specs assume a company `demo-consulting` exists and create it in `beforeAll`, so
they work against an empty database. And once local, the 5 s timeouts should disappear on their own — if they
do not, the timeout is a real bug rather than latency.

**No production data was modified to make any test pass.** The writes described in F1 were an unintended
consequence of running the suite as configured, and are reported rather than concealed.

### Lint — reported separately, as requested

`pnpm lint` fails at the first workspace, so each was run individually.

| Workspace          | Result       | Detail                                                                                                                                                                        |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared`  | **13 errors** | 5 × `no-unused-vars` (`forecast-model.ts:112`, `rolling-budget.ts:26,296`, `treasury-summary.ts:307`, `uploads/schemas.ts:19`); 8 × `no-useless-escape` (`uploads/pdf-text-to-csv.ts:55,56,64`). |
| `backend`          | **5 errors**  | All `no-unused-vars`: `auth/auth.service.ts:16`, `dto/ai-upload.dto.ts:1`, `treasury/treasury.controller.ts:2`, `uploads/upload-active-data.service.ts:2`, `why-changed/why-changed.service.ts:4`. |
| `frontend`         | **clean**     | "No ESLint warnings or errors" (with a deprecation notice: `next lint` is removed in Next.js 16).                                                                              |

**All 18 errors are pre-existing** — every file listed is unmodified in the working tree. None are in
`ai-gateway/`, `consent/`, `security/`, or the privacy page. All are trivially fixable; none affect behaviour.
Note that because `pnpm -r lint` stops at `packages/shared`, **the backend and frontend lint steps never run in
the default command** — worth knowing if lint is wired into CI.

---

## 11. PART 12 — RUSSIAN ADVERTISING READINESS

Advertising readiness is assessed strictly separately from production-data readiness.

### A. Run Yandex advertising — **NOT READY**

Blockers, in order:

1. **F2** — the consent notice links to a policy that 307-redirects away. Sending paid traffic to a form whose
   privacy link is broken is the single hardest blocker, and it is a one-line fix.
2. **U8** — Webvisor state unverified. Not a reason to change Metrica, but it must be *known* before the form
   receives real traffic.
3. **U12** — no confirmed operating entity. Privacy policy §1 is empty, and a Yandex Direct account must be
   opened by *someone*.
4. **LEGAL** — whether a Yandex Direct account tied to a Liqvia-affiliated entity can be opened and paid for at
   all. `marketing/ru-campaign/yandex-direct-strategy-en.md:14-17` flags this explicitly and does not resolve it.

### B. Collect Russian-language leads — **NOT READY**

The mechanism is built and correct (§9). The blocker is **F2 alone**: the policy is unreachable on the
collecting domain. Fix that, and this moves to **READY SUBJECT TO LEGAL REVIEW** — because U12 (who the
controller is) and the `lawful-basis` placeholder remain, and both are counsel's.

### C. Conduct discovery calls — **READY**

No product data processing, no personal data beyond ordinary business contact details, no technical dependency.
Nothing in this audit blocks it. Note only that call notes must not be pasted into the AI assistant.

### D. Demonstrate Liqvia using synthetic data — **READY**

`pnpm --filter @liqvia2/backend run prisma:seed:demo` produces a complete synthetic dataset. No personal data,
no residency question, no consent question. **Do the demo on the seeded dataset, not on the `qa/ok-bankrot/`
files** — those contain real client data (F3).

| Activity                    | Verdict                        | Exact remaining blocker                                    |
| --------------------------- | ------------------------------ | ---------------------------------------------------------- |
| A. Yandex advertising       | **NOT READY**                  | F2, then U8, U12, and sanctions/entity counsel             |
| B. Russian lead collection  | **NOT READY**                  | F2 (one line). Then U12 + `lawful-basis` → legal review    |
| C. Discovery calls          | **READY**                      | none                                                       |
| D. Synthetic demo           | **READY**                      | none — use the synthetic seed, not the QA client files     |

---

## 12. PART 13 — RUSSIAN CLIENT DATA READINESS

| # | Data class                                     | Classification                               | Reasoning                                                                                                                                                                     |
| - | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **Synthetic data**                             | **READY**                                    | No personal data. Seed exists. Nothing blocks it.                                                                                                                             |
| 2 | **Aggregated / non-personal company financials** | **CONTROLLED PILOT ONLY** + **REQUIRES LEGAL REVIEW** | Technically safe: the AI gateway transmits only this class, and it is provably non-identifying. But it still lands in a single Oregon-hosted database (U2) with unverified backups (U3), and the operating entity is undetermined (U12). Viable as a hand-held pilot with a named counterparty who is told exactly where the data sits — not as self-service. |
| 3 | **Personal information**                       | **NOT READY** + **REQUIRES LEGAL REVIEW**    | No `data_region` exists (R8, deferred by design). No retention or erasure path (Y10). No read-access audit (Y11). Russian personal-data localisation obligations are a legal question this audit does not answer. |
| 4 | **Raw bank statements**                        | **NOT READY**                                | Narratives are safe from AI (verified), but the rows persist verbatim and indefinitely in `UploadBatch.rowSnapshot` (R5) in a US-hosted database reachable from a developer laptop (F1). |
| 5 | **Raw AR/AP files**                            | **NOT READY**                                | Same as #4, plus `Customer Name` / `Supplier Name` are **required** template headers with no RU-safe alternative (Y9).                                                          |
| 6 | **Employee / payroll data**                    | **NOT READY** + **REQUIRES RU INFRASTRUCTURE** | The highest-sensitivity class. Y9 is explicit that RU customers will put employee names and salaries into `Description` and `Supplier Name` in practice — and there is no template preventing it. |
| 7 | **Customer / supplier contact information**    | **NOT READY**                                | No field accepts it structurally, which means it arrives in free-text fields where nothing controls it. Lead contact data is separate and covered in Part 12.                   |
| 8 | **Contracts / PDFs**                           | **NOT READY**                                | PDF text no longer reaches OpenAI (R2, verified). But no document storage exists at all (G1) — there is nowhere for a contract to go, so this is "not built" rather than "not safe". |

**Stated explicitly, as instructed:** the AI Privacy Gateway makes the *AI path* safe. It does nothing about
where data is stored, who can reach the database, how long rows persist, or which entity is the controller. **A
safer AI path is not a basis for accepting real Russian personal data.** Classes 3–8 are gated on R8 and Phase 3,
both deliberately deferred.

**One correction to the prior record:** class 2 processing has **already occurred**. The OK Bankrot engagement
(F3) put real Russian client financial data through Liqvia in pseudonymised form, with the re-identification key
held locally. That is a fact the risk register does not reflect, and it should be reconciled before the next
pilot rather than after.

---

## 13. PART 14 — Russian infrastructure

Nothing below was implemented, and current evidence does not change the conclusion to defer.

| Item                                 | Status                                              |
| ------------------------------------ | --------------------------------------------------- |
| `DATA_REGION` / `data_region` field  | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |
| RU database                          | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |
| RU server / application instance     | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |
| RU storage                           | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED** (no object storage exists at all today — G1) |
| RU authentication                    | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |
| RU backups                           | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |
| RU AI / local model                  | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |
| Regional routing / `DataPlaneRouter` | **DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED**    |

The reason to defer has strengthened, not weakened: `Liqvia_Funding_Residency_Roadmap.docx` §4 Phase 3 advises
against presenting Russia as a funding channel "for a business that touches banking data", citing a 2025 OFAC
penalty. Building a Russian data plane is a far larger commitment than accepting Russian capital. That tension
must be resolved as a business decision before any of the above is scoped.

---

## 14. PART 15 — sanctions and corporate structure

Reviewed `Liqvia_Funding_Residency_Roadmap.docx` and `marketing/ru-campaign/yandex-direct-strategy-en.md` **only
to extract unresolved decision points**. No sanctions-law conclusion is offered, and none should be inferred.

All items below are **LEGAL/COMPLIANCE DECISIONS, not software defects.** None can be closed by any change to
this codebase.

| # | Decision point                                                                                                                                   | Source                                                        | Professional advice needed                     |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------- |
| 1 | **Operating structure** — no entity is confirmed to exist yet; incorporation is a Phase 0 item that may not have happened.                        | Roadmap §4 Phase 0                                            | Australian startup lawyer + migration agent    |
| 2 | **Which entity is involved** — which entity operates `liqvia.info`, is the data controller, and would hold a Yandex Direct account. Blocks U12 and privacy policy §1. | Roadmap §4 Phase 0; policy `controller-identity`             | Corporate counsel                              |
| 3 | **Visa constraint on active management** — condition 8107 may bar the founder from actively operating the company; the roadmap advises a written migration-agent opinion **before anything else**. | Roadmap §2                                                    | Registered migration agent (MARN)              |
| 4 | **Payment flows** — whether a Yandex Direct account can be opened and funded from a Liqvia-affiliated entity through normal banking rails.        | `yandex-direct-strategy-en.md:14,17`                          | Sanctions-compliance counsel                   |
| 5 | **Banking** — whether Russian advertising activity creates risk for Liqvia's own banking relationships and future fintech partnerships.           | `yandex-direct-strategy-en.md:17(b)`                          | Sanctions counsel + banking counsel            |
| 6 | **Technology/service providers** — Yandex Direct became a domestic Russian entity after the July 2024 divestment; contracting with it is itself a decision. | `yandex-direct-strategy-en.md:14`                             | Sanctions-compliance counsel                   |
| 7 | **Sanctions exposure** — the roadmap's own position is that a banking-data product has no appetite for Russia-linked risk. The RU campaign is a parallel scenario that **explicitly does not override** that. **The tension is unresolved.** | Roadmap §4 Phase 3; `yandex-direct-strategy-en.md:14-17`     | Sanctions counsel                              |
| 8 | **Russian operational footprint** — whether a geo-restricted variant (Kazakhstan/Belarus only, no impressions in Russia, no payment through the Russian financial circuit) changes the analysis. Recorded in the strategy as a **hypothesis, not a recommendation**. | `yandex-direct-strategy-en.md:51`                             | Sanctions counsel + direct inquiry to Yandex   |
| 9 | **Processing already performed** — the OK Bankrot engagement (F3) means Russian client data has already been handled. Whether that creates any obligation is a question for counsel, not for this audit. | `qa/ok-bankrot/`; Roadmap §4 Phase 1                          | Data-protection counsel                        |

---

## 15. PART 17 — final prioritised outstanding list

Only genuine outstanding items. Everything verified resolved is absent by design.

| Priority | Issue | Status | Action | Who must act | Blocks what? |
| -------- | ----- | ------ | ------ | ------------ | ------------ |
| **P0** | **F1** — production DB credentials in `backend/.env`; the Jest suite writes to production, and did so during this audit | OPEN — ACTION REQUIRED | Decide whether to remove the test rows written to `demo-consulting`; repoint local dev at a local Postgres; make the test suite refuse a non-local `DATABASE_URL` | Owner (cleanup decision) + engineering | Safe development; Y7; any credible answer to a customer about production access |
| **P0** | **F2** — `/privacy` returns 307 → `/` on `liqvia.info`; consent-checkbox and footer links both dead | OPEN — ACTION REQUIRED | Add `/privacy` to `LANDING_ALLOWED_PREFIXES` (`middleware.ts:54-60`); re-verify with the curl matrix in §1 | Engineering | **Russian lead collection; Yandex advertising**; closing R9 |
| **P0** | **F3** — `qa/ok-bankrot/` holds a real Russian client re-identification key and is **not** gitignored | OPEN — ACTION REQUIRED | Add `qa/` to `.gitignore`; move the folder out of the repo tree into encrypted storage; confirm it was never committed | Owner + engineering | Prevents a real-client data leak into git history |
| **P0** | **U8** — Yandex Webvisor / form-field recording state unverified | OPEN — CONSOLE VERIFICATION | Follow §4.3; return four screenshots | Owner (Metrica console) | Any claim the lead form does not send PII to Yandex; scaling ad spend |
| **P0** | **U12** — operating entity / controller identity undetermined | OPEN — LEGAL REVIEW | Confirm whether an entity exists; if not, this is the gating decision | Owner + corporate counsel | Privacy policy §1 and §10; Yandex account; **all** RU activity beyond synthetic demo |
| **P1** | **U1, U2, U3** — service region, DB region, backup location | OPEN — CONSOLE VERIFICATION | Follow §3; note the DB hostname already indicates Oregon, and that `render.yaml` names a different DB than the live URL | Owner (Render console) | Any customer-facing residency or DR statement; privacy policy §6 |
| **P1** | **U6** — SMTP provider unidentified | OPEN — CONSOLE VERIFICATION | Read `SMTP_HOST` from Render env; do not share `SMTP_PASS` | Owner | Privacy policy §5 |
| **P1** | **U7** — OpenAI data-processing terms | OPEN — CONSOLE VERIFICATION | Read OpenAI org data controls + legal | Owner | Privacy policy §4 |
| **P1** | **Y6** — Metrica loads before any consent; no cookie banner | OPEN — ACTION REQUIRED | Decide whether a consent gate is required for the RU landing; a legal input, an engineering change | Owner + counsel, then engineering | Cookie-consent posture for RU advertising |
| **P1** | **Metrica field masking absent in code** | OPEN — ACTION REQUIRED | Add `ym-hide-content` to the form and `ym-disable-keys` to text inputs, so safety does not depend on a console toggle | Engineering | Defence-in-depth for U8; survives console changes |
| **P1** | **R5** — `rowSnapshot` retained indefinitely | OPEN — ACTION REQUIRED | Implement KEEP WITH RETENTION PERIOD (~90 days, null the snapshot, keep the batch) | Engineering | Real RU customer uploads; unbounded PII retention generally |
| **P1** | **Y10** — no lead retention limit or erasure path | OPEN — ACTION REQUIRED | Add a deletion endpoint or documented manual process; `ConsentRecord` already cascades | Engineering | Data-subject erasure requests; consent-withdrawal validity |
| **P1** | **Historical leads with no `ConsentRecord`** | OPEN — ACTION REQUIRED | Run the counting query in §9; if any exist, decide their disposition | Owner + counsel | Consent evidence completeness |
| **P1** | **Pre-existing test failure** — budget variance sign inverted (`budget.service.spec.ts`) | OPEN — ACTION REQUIRED | Establish whether the KPI service or the spec is correct; budget variance is user-facing | Engineering | Confidence in the financial engine (🟡 above) |
| **P2** | **Pre-existing test failure** — budget sample rejected by its own validator | OPEN — ACTION REQUIRED | Reconcile the sample file with `upload-validation.service.ts` | Engineering | Nothing today; erodes suite trust |
| **P2** | **18 pre-existing lint errors**; `pnpm -r lint` stops at `packages/shared` so backend/frontend never lint | OPEN — ACTION REQUIRED | Fix the unused-vars and useless-escapes; consider `--no-bail` | Engineering | Nothing today; CI signal quality |
| **P2** | **Y11** — no audit log of data *reads* | OPEN — ACTION REQUIRED | `AuditLog` exists for writes; extend to reads if/when RU pilots start | Engineering | RU pilot assurances |
| **P2** | **U4, U5, U9, U10** — PITR, log retention, Metrica data-sharing, CDN | OPEN — CONSOLE VERIFICATION | Batch with the other console reads; U10 needs only `dig` | Owner | Security questionnaires; processor-list completeness |
| **P2** | **Y9** — RU-safe import template absent | OPEN — ACTION REQUIRED | Design a `counterparty_code` template before any RU pilot upload | Engineering | Real RU customer uploads |
| **DEFERRED** | **R7, R8** + all RU infrastructure (Part 14) | DEFERRED — STRATEGIC/LEGAL DECISION REQUIRED | Do not scope until items 1–9 of Part 14 are decided | Owner | Full RU self-service |
| **LEGAL** | Seven privacy-policy placeholders; `LEGAL_REVIEW_PENDING` | OPEN — LEGAL REVIEW | Instruct counsel; supply the verified factual descriptions from this report | Owner + counsel | Publishing the policy; lead collection at scale |
| **LEGAL** | Sanctions / entity / payment / banking (Part 15, items 1–9) | OPEN — LEGAL REVIEW | Migration agent first, then sanctions counsel | Owner + counsel | Yandex advertising; any RU commercial activity |

---

## 16. The two questions, answered

### What is still outstanding before Liqvia can proceed with Russian advertising and controlled market validation?

**Four things, and only one of them is code.**

1. **Add `/privacy` to the landing middleware allowlist** (F2). One line. Until it lands, the consent notice
   points at a policy the user is redirected away from, and paid traffic should not be sent to that form.
2. **Verify Webvisor in the Metrica console** (U8) — §4.3 gives the exact clicks and the four screenshots. This
   changes nothing about Metrica; it establishes what is already happening.
3. **Determine the operating entity** (U12). This blocks privacy policy §1, the Yandex account, and everything
   downstream. It may be a legal decision that has not yet been made rather than a fact waiting to be looked up.
4. **Get the sanctions/entity opinion** the strategy documents themselves demand — starting with the migration
   agent, per the roadmap's own sequencing.

Discovery calls and synthetic demos are **ready now**, with no blockers. That is a real amount of market
validation available immediately.

### What is still outstanding before Liqvia can accept real Russian customer data?

**Everything above, plus the deferred architecture — and the answer differs sharply by data class.**

- **Synthetic:** ready.
- **Aggregated non-personal:** possible as a hand-held pilot once U1/U2/U3/U12 are answered and the counterparty
  is told plainly where the data sits. **This has already happened once** (OK Bankrot, F3) — reconcile that
  before the next one.
- **Anything containing personal data — bank statements, AR/AP, payroll, contacts, contracts:** **not ready, and
  not close.** It requires R8 (`data_region`), Phase 3 (RU data plane), R5 retention, Y9 (RU-safe template),
  Y10 (erasure), Y11 (read audit) — and, before any of that is worth scoping, resolution of the tension the
  funding roadmap identifies between a Russian operational footprint and a product that handles banking data.

The AI Privacy Gateway is genuinely finished and genuinely good. It is also, on its own, not a basis for
accepting real Russian personal data — it fixed the AI path, not the storage, access or jurisdiction questions.

---

## 17. Working-rule compliance

| Rule                                                     | Observed                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Do not reopen issues already proven resolved              | ✅ R1, R2, R3, R4, R6, Y3, Y8 closed with evidence and not revisited                                |
| Do not redesign working components without evidence       | ✅ No design proposals beyond the four proportionate controls in Part 7 and the R5 retention window |
| Do not implement Russian infrastructure                   | ✅ Nothing built                                                                                   |
| Do not make legal conclusions                             | ✅ Legal items classified and routed to counsel, never answered                                     |
| Do not infer console settings                             | ✅ U1–U12 remain unverified. The one exception is stated as *evidence from a live connection string*, not inference from a default, and console confirmation is still requested |
| Do not change Yandex Metrica because U8 is unverified     | ✅ No Metrica change made; the masking markup is a recommendation only                              |
| Do not weaken the AI Privacy Gateway                      | ✅ No gateway file modified                                                                        |
| Do not alter the deterministic financial engine           | ✅ No engine file modified                                                                         |
| Do not use real customer data for testing                 | ✅ All probes used the synthetic fixture. `qa/ok-bankrot/` was inspected for headers and row counts only, and is reported as a finding rather than used |
| Do not start another implementation phase                 | ✅ Only two files touched: this report, and a temporary probe spec that was deleted                 |

**Files changed by this audit:** `docs/FINAL_OUTSTANDING_ISSUES.md` (new). A temporary probe
(`backend/src/ai-gateway/tmp-quality-probe.spec.ts`) and a baseline `git worktree` were created and both removed.
No source file, configuration file or Metrica setting was modified.
