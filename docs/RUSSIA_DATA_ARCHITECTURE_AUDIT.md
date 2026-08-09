# Russia Data-Residency — Current Architecture Audit

**Status:** Current-state findings only. No architecture has been changed.
**Audit date:** 2026-08-09
**Branch audited:** `landing-production`
**Method:** Direct inspection of repository source, `render.yaml`, `Dockerfile`, Prisma schema and deployment configuration. Facts below are cited to file and line. Anything not verifiable from the repository is listed in §16 as an explicit unknown requiring account-console confirmation.

> **Headline finding.** Liqvia today is a **single-region, single-database, single-process application**. There is no data-region concept anywhere in the codebase — no tenant field, no routing layer, no storage abstraction. Russian tenant data would today be processed and stored in exactly the same place as all other tenant data. Additionally, three code paths send **raw, identifiable customer data to OpenAI in the United States**, and the marketing site advertises a "Data Residency Controls" security feature that **does not exist**.

---

## 1. Frontend

| Property   | Finding                                                                                                                 | Source                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Framework  | Next.js 15 (App Router), React, TailwindCSS                                                                             | `frontend/package.json`                |
| Rendering  | Server + client components, custom Node server (not `next start`)                                                       | `frontend/server/index.ts:1`           |
| Deployment | Render.com web service, Docker runtime, port 3000                                                                       | `render.yaml:8-13`, `Dockerfile:60-76` |
| Region     | **UNKNOWN** — no `region:` key in `render.yaml`; Render defaults to Oregon (US-West) unless overridden in the dashboard | `render.yaml` (absence)                |
| i18n       | `en`, `es`, `fr`, `ru` locale files                                                                                     | `frontend/src/locales/*.json`          |

## 2. Backend

| Property                  | Finding                                                                                                                                                                                          | Source                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Framework                 | NestJS 11 REST API, Prisma ORM                                                                                                                                                                   | `backend/package.json`                                                                  |
| Deployment topology       | **Embedded in the frontend process.** The custom Node server boots Next.js _and_ a Nest Express instance, routing `/api/*` to Nest in-process. One container, one port, no network hop, no CORS. | `frontend/server/index.ts:28-45`                                                        |
| Consequence for residency | There is **no separate deployable API tier**. A "RU API" does not exist as a separable unit today; the app is one artifact.                                                                      | —                                                                                       |
| Security middleware       | Helmet, `x-powered-by` disabled, CSP set in Next middleware                                                                                                                                      | `backend/src/security/apply-security-middleware.ts`, `frontend/src/middleware.ts:24-35` |
| Rate limiting             | `@nestjs/throttler`, per-endpoint per-IP                                                                                                                                                         | `backend/src/app.module.ts:35-40`                                                       |

## 3. Production database

| Property           | Finding                                                                                                                | Source                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Provider           | Render managed PostgreSQL                                                                                              | `render.yaml:2-6`                                             |
| Technology         | PostgreSQL (v16 locally)                                                                                               | `docker-compose.yml:3`                                        |
| Instance / DB name | `liqvia2-db` / database `liqvia2`, user `liqvia`                                                                       | `render.yaml:3-5`                                             |
| Plan               | **`free`**                                                                                                             | `render.yaml:6`                                               |
| Region             | **UNKNOWN** — not declared in blueprint                                                                                | `render.yaml` (absence)                                       |
| Connection         | `DATABASE_URL` injected from the managed DB; `sslmode=require` is force-appended in production                         | `render.yaml:15-18`, `backend/src/database-url.ts:3-13`       |
| Tenancy model      | **Single shared database, logical multi-tenancy by `companyId` column.** No schema-per-tenant, no database-per-region. | `backend/prisma/schema.prisma` (all models carry `companyId`) |
| Migrations         | Applied automatically on process start                                                                                 | `backend/src/run-migrations.ts:41-56`                         |
| Backups / PITR     | **UNKNOWN — and Render's free Postgres plan does not include point-in-time recovery.** Must be confirmed in console.   | see §16                                                       |

**Residency implication:** a RU data plane requires a second physical database. Today there is exactly one `DATABASE_URL` and one `PrismaClient` singleton (`backend/src/prisma/prisma.service.ts`), with no provider indirection.

## 4. Authentication

| Question asked         | Finding                                                                                                                                                                                                                             | Source                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Custom or third-party? | **Custom.** Built on `@nestjs/jwt` + `passport-jwt` + `bcryptjs`.                                                                                                                                                                   | `backend/src/auth/auth.service.ts`                     |
| Provider               | None. There is no external identity provider in the running code.                                                                                                                                                                   | —                                                      |
| **Clerk**              | Referenced in `docs/engineering/deployment.md`, `.env` and `.env.example` as the auth provider. **This is stale.** No Clerk package is installed and no Clerk code path exists. The documentation is wrong and should be corrected. | `docs/engineering/deployment.md:7`, `.env`             |
| Passwords handled by   | **Liqvia.** `bcrypt.hash(password, 10)`, stored as `UserProfile.passwordHash`.                                                                                                                                                      | `auth.service.ts:20,44-53`                             |
| User data stored       | `email` (lowercased), `name`, `role`, `companyId`, `isDemoMode`, password hash, password-reset token hash + expiry                                                                                                                  | `schema.prisma` `UserProfile`; `auth.service.ts:45-53` |
| Where stored           | The single global Postgres — same DB as all financial data                                                                                                                                                                          | —                                                      |
| Session                | Stateless JWT, `JWT_SECRET` generated by Render, 7-day expiry                                                                                                                                                                       | `render.yaml:23-26`                                    |

**Residency implication:** RU user identity data (name + work email, collected at `/register`) lands in the global DB. Financial-data localisation alone would not address this — the account record itself is personal data.

## 5. File uploads

| Question asked                                         | Finding                                                                                                                                                                                                                                                                       | Source                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Where received                                         | `POST /api/uploads/*` multipart endpoints on the single web service                                                                                                                                                                                                           | `backend/src/uploads/upload.controller.ts`                             |
| Storage engine                                         | **Multer memory storage.** `FileInterceptor` is configured with `limits` only — no `dest`, no `storage`, so Multer defaults to in-memory buffers.                                                                                                                             | `upload.controller.ts:141-143,175-178,334-336`                         |
| Raw file persisted to disk?                            | **No.** No `diskStorage`, no `writeFileSync`, no `os.tmpdir()`, no `createWriteStream` anywhere in backend or frontend source (verified by repo-wide grep). Buffers live in process RAM for the request duration.                                                             | —                                                                      |
| Object-storage provider                                | **None.** No S3, R2, GCS, Supabase Storage, Azure Blob or MinIO client is installed or referenced.                                                                                                                                                                            | verified by repo-wide grep                                             |
| Signed-URL direct-to-provider upload from the browser? | **No.** All uploads go browser → Liqvia API. No presigned-URL flow exists. (This is a _good_ finding for §12 of the brief.)                                                                                                                                                   | —                                                                      |
| What _is_ persisted                                    | `UploadBatch.fileName` (original filename) and **`UploadBatch.rowSnapshot Json?` — the full validated row set, stored verbatim in Postgres**, used for re-import and delta comparison. Plus the parsed domain rows (`Receivable`, `Payable`, `WeeklyActual`, `CashMovement`). | `schema.prisma:560-581`; `upload-import.service.ts:93,135,151,248-253` |
| Deletion behaviour                                     | `onDelete: Cascade` from `Company`. Soft-delete (`deletedAt`) on domain records. **No retention/expiry policy for `rowSnapshot`.**                                                                                                                                            | `schema.prisma:572`                                                    |
| Versioning                                             | N/A (no object storage)                                                                                                                                                                                                                                                       | —                                                                      |

## 6. AI

| Question asked              | Finding                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Provider(s)                 | **OpenAI only.**                                                                        |
| Model(s)                    | `process.env.OPENAI_MODEL ?? 'gpt-4o-mini'`                                             |
| Endpoint                    | `https://api.openai.com/v1/chat/completions` (US-hosted)                                |
| Number of direct call sites | **6**, across 2 files. There is no gateway, no abstraction, no allowlist, no redaction. |

### Exact code paths that call AI

| #   | File:line                                      | Purpose                 |
| --- | ---------------------------------------------- | ----------------------- |
| 1   | `backend/src/ai/ai.service.ts:278`             | Business Pulse briefing |
| 2   | `backend/src/ai/ai.service.ts:409`             | Decision Centre         |
| 3   | `backend/src/ai/ai.service.ts:526`             | "Why has this changed?" |
| 4   | `backend/src/ai/ai.service.ts:586`             | AI CFO chat             |
| 5   | `backend/src/ai/ai.service.ts:657`             | AI CFO insight/briefing |
| 6   | `backend/src/uploads/ai-upload.service.ts:376` | PDF → CSV extraction    |
| 7   | `backend/src/uploads/ai-upload.service.ts:438` | Upload column mapping   |

### What data is sent — verified

Call sites 1–5 all serialise the **entire `TreasuryAiContext` object** via
`buildContextMessage()` → `JSON.stringify(context, null, 2)` (`ai.service.ts:602`).
That object is assembled in `backend/src/ai/ai-data.service.ts` and **provably contains**:

| Field                                     | Content                                                         | Built at                       |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `companyName`                             | Legal/trading company name                                      | `ai-context.ts:15`             |
| `bankAccounts[].name`                     | Bank account names                                              | `ai-data.service.ts:76-81`     |
| `cashTransactions[].description`          | **Raw bank transaction descriptions, verbatim** (up to 80 rows) | `ai-data.service.ts:87-97,178` |
| `recentOutflows` / `recentInflows`        | Same raw descriptions (40 + 20 rows)                            | `ai-data.service.ts:99-101`    |
| `receivablesDetail[].counterparty`        | **`Receivable.customerName` — customer identity** (up to 30)    | `ai-data.service.ts:103-125`   |
| `payablesDetail[].counterparty`           | **`Payable.supplierName` — supplier identity** (up to 30)       | `ai-data.service.ts:127-148`   |
| `recurringObligations[].name`             | Obligation names (can encode payroll/lease/person detail)       | `ai-data.service.ts:186-203`   |
| `payrollReadiness`                        | Payroll amounts and dates                                       | `ai-data.service.ts:~222`      |
| `settlementTimeline[].destinationAccount` | Named destination accounts                                      | `ai-data.service.ts:~228`      |
| user's free-text question                 | Passed through as chat history                                  | `ai.service.ts:590-596`        |

| Brief's question                            | Answer                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are raw uploaded rows sent?                 | **YES** — call site 7 sends `parsed.rows.slice(0, 8)`, i.e. eight complete raw data rows with all values, not just headers (`ai-upload.service.ts:421-434`).                                                                                                         |
| Are names/descriptions/counterparties sent? | **YES** — all three, see table above.                                                                                                                                                                                                                                |
| Are uploaded documents sent?                | **YES** — call site 6 sends up to **12,000 characters of raw extracted PDF text** from bank statements (`ai-upload.service.ts:367-397`).                                                                                                                             |
| Are AI requests/responses stored by Liqvia? | **YES.** Every response is written to `AiInsight.content`, and **`AiInsight.context` stores the entire context JSON including the user's last message** (`ai.service.ts:152-160, 207-215, 253-256, 385-392, 502-505`). `AiLog` additionally records model + latency. |

> **This is the single largest residency and confidentiality exposure in the product.** For a Russian tenant, current code would transmit customer names, supplier names, raw bank narratives and raw statement text to a US processor on every AI interaction.

## 7. Logging and monitoring

| System                      | Present?                                                                      | Notes                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Render logs (stdout/stderr) | **Yes — the only log sink.**                                                  | Region follows the Render service region (unknown). Retention per Render plan. |
| Sentry                      | No                                                                            | Not installed.                                                                 |
| Datadog                     | No                                                                            | Not installed.                                                                 |
| Logtail / Better Stack      | No                                                                            | Not installed.                                                                 |
| PostHog                     | No                                                                            | Not installed.                                                                 |
| Product analytics in-app    | No                                                                            | —                                                                              |
| Other telemetry             | Next.js telemetry **disabled** (`NEXT_TELEMETRY_DISABLED=1`, `Dockerfile:29`) | Good.                                                                          |

**Redaction policy: none exists.** Logging is ad-hoc `Logger`/`console`. Two confirmed PII leaks into logs:

- `backend/src/auth/mail.service.ts:38` — logs the recipient email address on unconfigured SMTP.
- `backend/src/auth/mail.service.ts:63` — logs the recipient email address on send failure.

Error paths log `String(err)` from OpenAI/parse failures (`ai.service.ts:134,186,244,371,496`; `ai-upload.service.ts:263,360`), which is low-risk today but is an uncontrolled channel — a future library could surface payload fragments in `err.message`.

## 8. Email

| Property                  | Finding                                                                                | Source                             |
| ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| Mechanism                 | Nodemailer over SMTP                                                                   | `backend/src/auth/mail.service.ts` |
| Provider                  | **UNKNOWN** — `SMTP_HOST` is `sync: false`, set only in the Render dashboard           | `render.yaml:36-44`                |
| From address              | `noreply@liqvia.com` (default)                                                         | `render.yaml:44`                   |
| Stored recipient data     | Email addresses in `UserProfile.email`, `UserCompanyLink.email`, `CashOsLead.email`    | `schema.prisma`                    |
| Templates                 | One only — password reset (plain text + minimal HTML), inline in code                  | `mail.service.ts:42-60`            |
| **Lead notifications**    | **None.** Landing-page leads are written to the database only; no email is dispatched. | `cash-os-leads.service.ts:34-40`   |
| Other transactional email | None. `NotificationsService` is in-app only — it sends no email.                       | verified                           |

## 9. Marketing analytics

| Script                                  | Present?                                                                                                               | Detail                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Yandex Metrica**                      | **Yes — the only tracker.** Counter `111417446` (hardcoded default, overridable via `NEXT_PUBLIC_YANDEX_METRICA_ID`).  | `frontend/src/components/analytics/yandex-metrica.tsx:6` |
| Metrica scope                           | Loads **only** on `liqvia.info` / `www.liqvia.info` — host-gated, so the authenticated product domain is not tracked.  | `yandex-metrica.tsx:7,14`                                |
| Metrica options                         | `ssr`, `clickmap`, `accurateTrackBounce`, `trackLinks`                                                                 | `yandex-metrica.tsx:24-29`                               |
| **Webvisor**                            | **Not enabled in code** (`webvisor` flag absent). _May still be enabled server-side in the Metrica console_ — see §16. | `yandex-metrica.tsx:24-29`                               |
| Google Analytics                        | **No**                                                                                                                 | —                                                        |
| Meta Pixel                              | **No**                                                                                                                 | —                                                        |
| LinkedIn Insight                        | **No** (only a `linkedin_click` goal name)                                                                             | `cash-os/analytics.ts:22`                                |
| Hotjar / Clarity / Plausible / Mixpanel | **No**                                                                                                                 | —                                                        |
| CSP                                     | Metrica origins (18 regional hosts) + `yastatic.net` allowlisted for `script-src`/`img-src`/`connect-src`              | `frontend/src/middleware.ts:4-35`                        |

Goal events fired: `hero_primary_cta`, `hero_secondary_cta`, `middle_primary_cta`, `pilot_apply_cta`, `form_start`, `form_submit`, `product_walkthrough_open`, `faq_click`, `deep_scroll_90`, `linkedin_click` (`cash-os/analytics.ts:12-23`).

## 10. Backups and disaster recovery

| Item                      | Finding                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary storage           | Render managed Postgres, region unknown                                                                                                                         |
| Automatic backups         | **UNKNOWN.** Blueprint declares `plan: free`; Render's free Postgres tier does not offer PITR and has restricted backup retention. Must be verified in console. |
| PITR                      | **Not available on the declared plan.**                                                                                                                         |
| Read replicas             | None declared                                                                                                                                                   |
| Manual exports            | No tooling in repo                                                                                                                                              |
| Snapshots                 | Not configured in repo                                                                                                                                          |
| Object-storage versioning | N/A — no object storage                                                                                                                                         |
| Documented DR runbook     | **None exists.**                                                                                                                                                |

## 11. Scheduled jobs / cron workers

**None.** No `@nestjs/schedule`, no `@Cron`, no `setInterval` job, no Render cron service in `render.yaml`. Verified by repo-wide grep.

## 12. Queues / cache / Redis

**None.** No Redis, BullMQ, ioredis or any queue/cache dependency. All work is synchronous in the request cycle.

## 13. CDN / proxy infrastructure

Render's built-in edge/proxy terminates TLS and forwards `x-forwarded-host` (consumed at `frontend/src/middleware.ts:60`). **No Cloudflare, Fastly or other CDN is configured in the repository.** Whether one sits in front of the domains at DNS level is an unknown (§16).

## 14. Complete list of third-party processors

| Processor                        | What it receives                                                                                                         | Configured where                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Render.com**                   | Everything — application compute, database, logs                                                                         | `render.yaml`                           |
| **OpenAI**                       | Treasury context incl. counterparty names + raw transaction descriptions; raw PDF statement text; raw upload sample rows | `ai.service.ts`, `ai-upload.service.ts` |
| **Yandex (Metrica)**             | Landing-page behavioural data, IP, cookies, click maps — `liqvia.info` only                                              | `yandex-metrica.tsx`                    |
| **SMTP provider (unidentified)** | Recipient email address + password-reset link                                                                            | `mail.service.ts`                       |
| **GitHub Actions**               | CI only — synthetic/demo data, no production data                                                                        | `.github/workflows/ci.yml`              |

No other outbound integration exists. There is no Xero/QuickBooks/bank-feed connector implemented (the `ExternalSource` enum reserves the names but nothing calls out).

---

## 15. Data-flow table

Risk key — **GREEN** = verified in-region and non-identifying · **YELLOW** = unverified or contains personal data but region controllable · **RED** = verified transfer of identifiable data outside RU, or a claim contradicted by code.

| System                            | Data received                                                                                    | Contains personal data?      | Current region                                  | Persistent?             | Backup location   | Third party? | RU risk                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------- | ----------------------- | ----------------- | ------------ | -------------------------------------------------------------------------- |
| Render web service (Next+Nest)    | All request bodies, uploaded file buffers, auth credentials                                      | **Yes**                      | **Unknown** (Render default US-West unless set) | No (RAM only for files) | N/A               | Yes          | **RED**                                                                    |
| Render PostgreSQL `liqvia2-db`    | All tenant financial data, `rowSnapshot` raw rows, user identities, RU leads                     | **Yes**                      | **Unknown**                                     | Yes                     | Unknown           | Yes          | **RED**                                                                    |
| Render logs                       | Timestamps, error strings, **recipient email addresses**                                         | **Yes** (emails)             | Follows service region                          | Yes (retention unknown) | Unknown           | Yes          | **RED**                                                                    |
| **OpenAI `/v1/chat/completions`** | Company name, customer names, supplier names, raw bank narratives, raw PDF text, raw upload rows | **Yes**                      | **United States**                               | Per OpenAI policy       | OpenAI-controlled | Yes          | **RED**                                                                    |
| `AiInsight` table                 | Full AI context JSON **+ user's free-text question** + AI response                               | **Yes**                      | Same as DB (unknown)                            | Yes                     | Unknown           | No (own DB)  | **RED**                                                                    |
| `UploadBatch.rowSnapshot`         | Verbatim validated upload rows                                                                   | **Yes**                      | Same as DB                                      | Yes, no expiry          | Unknown           | No           | **RED**                                                                    |
| `CashOsLead` table                | RU lead name, phone, email, company, industry, free comment                                      | **Yes**                      | Same as DB (non-RU)                             | Yes                     | Unknown           | No           | **RED**                                                                    |
| Yandex Metrica                    | Landing behaviour, IP, cookie IDs                                                                | **Yes** (online identifiers) | **Russia**                                      | Yes                     | Yandex            | Yes          | **YELLOW** — in-region, but Webvisor status and consent capture unverified |
| SMTP provider                     | Recipient address, reset link                                                                    | **Yes**                      | **Unknown**                                     | Provider-side           | Unknown           | Yes          | **YELLOW**                                                                 |
| GitHub Actions CI                 | Synthetic demo data only                                                                         | No                           | US                                              | Ephemeral               | N/A               | Yes          | **GREEN**                                                                  |
| Render edge/proxy                 | TLS termination, headers, IPs                                                                    | Yes (IP)                     | Unknown                                         | Access logs             | Unknown           | Yes          | **YELLOW**                                                                 |
| Object storage                    | —                                                                                                | —                            | **Does not exist**                              | —                       | —                 | —            | **GREEN** (nothing to leak)                                                |
| Cron / queues / Redis             | —                                                                                                | —                            | **Do not exist**                                | —                       | —                 | —            | **GREEN**                                                                  |

Nothing is marked GREEN unless its absence or safety was positively verified in source.

---

## 16. Unknowns requiring account-console verification

These **cannot** be determined from the repository. Each must be confirmed before any residency claim is made.

| #   | Unknown                                                                                             | Where to verify                                | Why it matters                                                                              |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| U1  | Render **web service region**                                                                       | Render dashboard → service → Settings          | Determines where RU data is processed today                                                 |
| U2  | Render **Postgres region**                                                                          | Render dashboard → database                    | Determines where RU data is stored today                                                    |
| U3  | Render Postgres **backup schedule, retention and physical backup location**                         | Render dashboard → database → Backups          | A RU primary DB is meaningless if backups land abroad                                       |
| U4  | Whether PITR is available/enabled on the current plan                                               | Render dashboard                               | Stated DR capability                                                                        |
| U5  | Render **log retention period and storage region**                                                  | Render dashboard                               | Logs currently contain email addresses                                                      |
| U6  | **SMTP provider identity and region**                                                               | Render env vars → `SMTP_HOST`                  | Unidentified processor holding user emails                                                  |
| U7  | **OpenAI data-processing terms** in force (retention, training opt-out, zero-retention endorsement) | OpenAI org settings                            | Governs the RED transfers in §6                                                             |
| U8  | **Yandex Metrica: Webvisor enabled server-side?**                                                   | Metrica console → counter 111417446 → Settings | Webvisor records form input and session replay — materially changes the risk classification |
| U9  | Metrica **data-sharing / offline-conversion settings**                                              | Metrica console                                | Scope of Yandex processing                                                                  |
| U10 | Whether a **CDN (Cloudflare etc.)** fronts `liqvia.org` / `liqvia.info` at DNS level                | DNS/registrar                                  | Undocumented processor + region                                                             |
| U11 | Whether production DB dumps have **ever been downloaded to developer machines**                     | Team process review                            | §17 policy gap                                                                              |
| U12 | Registrar/hosting arrangement and legal entity for `liqvia.info`                                    | Registrar                                      | RU localisation obligations attach to the operator                                          |

---

## 17. Development and support access

| Question                                         | Finding                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can developers download production data locally? | **Yes — nothing prevents it.** `DATABASE_URL` is a standard Postgres connection string; anyone with the Render credential can `pg_dump` production. There is no bastion, no IP allowlist in the repo, no read-only support role, no audit of access.                                     |
| Existing policy                                  | **None in the repository.**                                                                                                                                                                                                                                                              |
| Test data available                              | Good news: a full synthetic demo seed already exists — 4 demo companies exercising every liquidity tier (`backend/src/demo/*`, `samples/demo-data/`), runnable via `pnpm --filter @liqvia2/backend run prisma:seed:demo`. **There is no technical need to use production data locally.** |

**Recommended policy (to adopt, not yet implemented):** no RU production database dump may be copied to a developer workstation; local development uses the existing synthetic seed exclusively; any RU production data access is via time-boxed, logged, read-only sessions.

---

## 18. Security marketing claim — verification (brief §21)

**The claim.** The global website's security section presents four benefits, one of which is:

- `en`: "Data Residency Controls" — _"Keep financial data aligned with regional compliance requirements."_ (`frontend/src/locales/en.json:134-135`)
- Also translated in `ru.json`, `es.json`, `fr.json` at the same keys, and rendered at `frontend/src/components/home/security-trust-section.tsx:15`.

**Verification result: the feature does not exist.**

| What the claim implies                        | Actual state                                                   |
| --------------------------------------------- | -------------------------------------------------------------- |
| Data can be confined to a region              | Single global DB, single region, no tenant region field        |
| Regional controls are configurable            | No configuration surface of any kind exists                    |
| Financial data stays in a chosen jurisdiction | Financial data is additionally transmitted to OpenAI in the US |

There is no `data_region` column, no routing layer, no regional storage — verified by full-schema and full-source inspection.

**This is an unsubstantiated compliance claim and should be corrected now, independently of the RU programme.** Recommended replacement copy — descriptive of what is actually true, making no legal or regulatory claim:

> **EN — "Regional Hosting Options"** — "Liqvia is deployed on managed infrastructure with hosting-region options available for enterprise arrangements."

Or, if nothing configurable can honestly be offered yet, drop the fourth card entirely and keep the three verified claims (encryption in transit, role-based access, audit logging — each of which should itself be re-verified before publication).

**Do not** re-state a residency capability in any locale until §29's RU data plane is implemented and independently confirmed.

---

## 19. Summary of findings by severity

### RED — verified exposure

| ID  | Finding                                                                                                           | Location                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| R1  | Raw customer + supplier names, and raw bank transaction descriptions, sent to OpenAI (US) on every AI interaction | `ai-data.service.ts:103-148,87-97` → `ai.service.ts:602` |
| R2  | Up to 12,000 chars of raw PDF bank-statement text sent to OpenAI                                                  | `ai-upload.service.ts:367-397`                           |
| R3  | Eight raw upload data rows (all values) sent to OpenAI                                                            | `ai-upload.service.ts:421-434`                           |
| R4  | Full AI context **including the user's free-text question** persisted to `AiInsight.context`                      | `ai.service.ts:152-160`                                  |
| R5  | `UploadBatch.rowSnapshot` stores verbatim uploaded rows indefinitely, no retention policy                         | `upload-import.service.ts:93`                            |
| R6  | Marketing claims "Data Residency Controls" — feature does not exist                                               | `en.json:134`, `security-trust-section.tsx:15`           |
| R7  | RU landing leads (name, phone, email, company) stored in the non-RU global database                               | `cash-os-leads.service.ts:34-40`                         |
| R8  | No data-region concept exists anywhere — no field, no routing, no fail-closed behaviour                           | whole codebase                                           |

### YELLOW — unverified or policy gap

| ID  | Finding                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Y1  | Render service + database regions unknown (U1, U2)                                                                                           |
| Y2  | Backup location, retention and PITR unknown; free plan lacks PITR (U3, U4)                                                                   |
| Y3  | Recipient email addresses written to logs; no redaction policy                                                                               | `mail.service.ts:38,63` |
| Y4  | SMTP provider unidentified (U6)                                                                                                              |
| Y5  | Metrica Webvisor status unverified (U8)                                                                                                      |
| Y6  | Lead form shows a consent sentence but **stores no consent record** (no checkbox, no timestamp, no policy version) — `lead-form.tsx:192-194` |
| Y7  | No policy or control preventing production data download to developer machines                                                               |
| Y8  | `docs/engineering/deployment.md` documents Clerk as the auth provider — factually wrong, auth is custom bcrypt+JWT                           |

### GREEN — verified safe (absence of risk)

| ID  | Finding                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| G1  | **No object storage exists** — no S3/R2/GCS/Azure; nothing to mis-region                                             |
| G2  | **No browser→third-party signed-URL uploads** — all uploads terminate at Liqvia's API (directly answers brief §12)   |
| G3  | **No files written to disk or `/tmp`** — Multer memory storage only; no container-disk exposure (brief §13)          |
| G4  | **No cron, no queues, no Redis** — no background worker leakage surface                                              |
| G5  | **No GA / Meta Pixel / Hotjar / LinkedIn Insight** on the RU landing — Metrica only, and host-gated to `liqvia.info` |
| G6  | Next.js telemetry disabled at build                                                                                  |
| G7  | Forecasting is already fully deterministic — see below                                                               |

### Deterministic engine — confirmed compliant with brief §22

The financial engine is **already** independent of AI. `backend/src/treasury/forecast-calculation.service.ts`, `treasury-kpi.service.ts`, `liquidity-risk.service.ts`, `scenarios/`, `recurring-obligations/occurrences.ts` and `packages/shared` compute the 13-week forecast, runway, AR/AP, scenario arithmetic, obligation scheduling and budget-vs-actual with **no AI involvement**. AI receives already-computed outputs and narrates them; every AI feature has a deterministic rule-based fallback that produces the same figures. **No change is required here, and none should be made.**

---

## 20. What this means for the RU programme

1. **Nothing about the current architecture is RU-ready.** The gap is not a flag — it is a missing data plane.
2. **The AI path is the most urgent problem** and is also the cheapest to fix, because the engine is already deterministic: the AI only needs aggregates, not identities. This can be fixed before any infrastructure work.
3. **Two items should be fixed immediately, independent of the RU decision** — the false residency marketing claim (R6) and the email addresses in logs (Y3).
4. **Twelve facts must be confirmed in provider consoles** (§16) before any residency statement is made to a customer or regulator.

Proposed target architecture, phasing, database changes, environment variables and risk assessment are in `docs/RUSSIA_DATA_RISK_REGISTER.md` and `docs/RUSSIA_DATA_FLOW_DIAGRAM.md`. Marketing-specific flows are in `docs/RU_MARKETING_DATA_FLOW.md`.
