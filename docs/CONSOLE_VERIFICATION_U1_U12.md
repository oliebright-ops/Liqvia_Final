# Console Verification U1–U12 — Runbook and Record

**Purpose.** Twelve facts about Liqvia's production estate cannot be determined from this
repository. They live in provider consoles (Render, Yandex Metrica, DNS, OpenAI). Each must be
read from the console by a person with account access and recorded below, with a screenshot or
export attached, before any statement is made to a customer, investor or regulator about where
Liqvia data is processed or stored.

**Status: NOT VERIFIED.** No item below has been confirmed. The `Result` column is deliberately
empty. Nothing in this repository — `render.yaml`, `Dockerfile`, the Prisma schema — establishes
a region, and inferring one from defaults is not verification.

> **Rule.** Do not write a hosting region, backup location or retention period into marketing
> copy, the privacy policy, a security questionnaire or a customer contract until the
> corresponding row here is filled in, dated and signed off.

---

## How to record a result

For each item: perform the steps, paste the literal value shown in the console (not a
paraphrase), attach evidence to the ticket, and fill in `Verified by` / `Date`. If a setting
does not exist on the current plan, record that fact — "not available on plan X" is a valid and
important result.

---

## U1 — Render web service region

| Field       | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Question    | Which Render region runs the `liqvia2` web service?               |
| Where       | Render dashboard → Services → `liqvia2` → Settings → Region       |
| Why         | Determines where every request body, upload buffer and credential is processed |
| Repo says   | Nothing. `render.yaml` declares no `region:` key.                 |
| **Result**  | _(not verified)_                                                  |
| Verified by | —                                                                 |
| Date        | —                                                                 |

## U2 — Render PostgreSQL region

| Field       | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| Question    | Which region hosts the `liqvia2-db` managed Postgres instance?          |
| Where       | Render dashboard → Databases → `liqvia2-db` → Info / Settings           |
| Why         | Determines where all tenant financial data and user identities are stored |
| Repo says   | Nothing. `render.yaml:2-6` declares name, user, database and `plan: free` only. |
| **Result**  | _(not verified)_                                                        |
| Verified by | —                                                                       |
| Date        | —                                                                       |

## U3 — Backup / snapshot schedule, retention and physical location

| Field       | Value                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| Question    | Are backups taken? On what schedule? Retained how long? Stored in which region/bucket? |
| Where       | Render dashboard → Databases → `liqvia2-db` → Backups (and Recovery, if present)   |
| Why         | A primary database in one jurisdiction is meaningless if its backups land in another |
| Repo says   | Nothing. No backup tooling exists in the repository.                               |
| **Result**  | _(not verified)_                                                                   |
| Verified by | —                                                                                  |
| Date        | —                                                                                  |

## U4 — Point-in-time recovery (PITR)

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Question    | Is PITR available on the current plan, and is it enabled? What is the window? |
| Where       | Render dashboard → Databases → `liqvia2-db` → Recovery                      |
| Why         | Any stated RPO/RTO depends on this                                          |
| Repo says   | `render.yaml:6` declares `plan: free`. Render's free Postgres tier does not offer PITR — **confirm whether the deployed instance is still on `free`**, since the blueprint may have been overridden in the dashboard. |
| **Result**  | _(not verified)_                                                            |
| Verified by | —                                                                           |
| Date        | —                                                                           |

## U5 — Log retention period and log storage region

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Question    | How long does Render retain service logs, and where are they stored? |
| Where       | Render dashboard → Service → Logs; plan documentation        |
| Why         | Logs are a data store like any other                         |
| Repo says   | Render stdout/stderr is the only log sink; no Sentry/Datadog/Logtail is installed. Email addresses are now masked before logging (`backend/src/security/log-redaction.ts`), but historic log entries predating this change still contain them. |
| **Result**  | _(not verified)_                                             |
| Verified by | —                                                            |
| Date        | —                                                            |
| Follow-up   | If historic logs are still retained, decide whether to request early expiry. |

## U6 — SMTP provider identity and region

| Field       | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| Question    | Which SMTP provider is configured, and where does it process mail?   |
| Where       | Render dashboard → Service → Environment → `SMTP_HOST`               |
| Why         | An unidentified processor currently receives user email addresses and password-reset links |
| Repo says   | `render.yaml:36-44` marks `SMTP_HOST` as `sync: false` — set only in the dashboard. The provider is unknown to the repository. |
| **Result**  | _(not verified)_                                                     |
| Verified by | —                                                                    |
| Date        | —                                                                    |

## U7 — OpenAI data-processing terms in force

| Field       | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| Question    | Which OpenAI terms apply: API data retention window, training opt-out status, zero-data-retention eligibility, DPA signed? |
| Where       | OpenAI platform → Organization → Data controls / Legal                       |
| Why         | Governs what happens to everything the AI Privacy Gateway sends              |
| Repo says   | After Phases 1–2, only aggregated non-identifying financial metrics leave the product. This lowers the stakes but does not remove the need for the terms to be known. |
| **Result**  | _(not verified)_                                                             |
| Verified by | —                                                                            |
| Date        | —                                                                            |

## U8 — Yandex Metrica: Webvisor and sensitive-field behaviour

| Field       | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Question    | (a) Is Webvisor enabled server-side for counter `111417446`? (b) If yes, is form-content recording on? (c) Are fields masked by default or only when explicitly marked? |
| Where       | Metrica console → counter 111417446 → Settings → Webvisor tab              |
| Why         | Webvisor records session replay and can capture form input. The lead form collects name, company, email, phone and a free-text comment. If Webvisor is recording that form, Yandex receives lead PII regardless of what the code enables. |
| Repo says   | `frontend/src/components/analytics/yandex-metrica.tsx:24-29` initialises with `ssr`, `clickmap`, `accurateTrackBounce`, `trackLinks` and **no `webvisor` flag**. The console setting is independent of this and must be read directly. |
| **Result**  | _(not verified)_                                                          |
| Verified by | —                                                                         |
| Date        | —                                                                         |
| Action if enabled | Either disable Webvisor, or mark the lead form and every input inside it with Metrica's content-hiding attribute, and re-verify. |

## U9 — Metrica data-sharing / offline-conversion settings

| Field       | Value                                                          |
| ----------- | -------------------------------------------------------------- |
| Question    | Is data sharing with other Yandex services enabled? Are offline conversions or CRM uploads configured? |
| Where       | Metrica console → counter 111417446 → Settings → General / Data |
| Why         | Determines the true scope of Yandex processing                 |
| **Result**  | _(not verified)_                                               |
| Verified by | —                                                              |
| Date        | —                                                              |

## U10 — CDN in front of the domains

| Field       | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| Question    | Does Cloudflare or any other CDN/proxy sit in front of `liqvia.org` / `liqvia.info` at DNS level? |
| Where       | Registrar/DNS zone; `dig +short NS liqvia.info`, `dig +short liqvia.info` |
| Why         | A CDN is an undocumented processor that terminates TLS and sees every request |
| Repo says   | No CDN is configured in the repository. Render's own edge terminates TLS and forwards `x-forwarded-host` (`frontend/src/middleware.ts:60`). |
| **Result**  | _(not verified)_                                                     |
| Verified by | —                                                                    |
| Date        | —                                                                    |

## U11 — Has production data ever been copied to a developer machine?

| Field       | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| Question    | Has any production `pg_dump` / export ever been downloaded locally? By whom, when, and does a copy still exist? |
| Where       | Team process review; interview everyone holding Render credentials   |
| Why         | Nothing in the system prevents it — `DATABASE_URL` is an ordinary connection string with no bastion, IP allowlist or read-only support role |
| Mitigation available today | A complete synthetic demo seed already exists (`pnpm --filter @liqvia2/backend run prisma:seed:demo`), so there is no technical need to use production data locally. |
| **Result**  | _(not verified)_                                                     |
| Verified by | —                                                                    |
| Date        | —                                                                    |

## U12 — Registrar, hosting arrangement and legal entity for `liqvia.info`

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Question    | Which registrar holds the domain, under which legal entity, and which entity is the operator of the site? |
| Where       | Registrar account; corporate records                                        |
| Why         | Data-protection obligations attach to the operating entity, not to the codebase. This also blocks §1 of the privacy policy (`controller-identity`). |
| **Result**  | _(not verified)_                                                            |
| Verified by | —                                                                           |
| Date        | —                                                                           |

---

## Blocking relationships

| Blocked item                                              | Blocked by         |
| --------------------------------------------------------- | ------------------ |
| Any customer-facing statement about hosting region        | U1, U2             |
| Any statement about backups, DR, RPO or RTO               | U3, U4             |
| Privacy policy §1 (controller identity)                   | U12                |
| Privacy policy §5 (processor list — SMTP entry)           | U6                 |
| Privacy policy §6 (where data is stored)                  | U1, U2, U3, U10    |
| Privacy policy §4 (AI processor terms)                    | U7                 |
| Publishing the privacy policy at all (`LEGAL_REVIEW_PENDING = false`) | U1, U2, U3, U6, U7, U12 + counsel sign-off |
| Any claim that the lead form does not leak PII to Yandex  | U8                 |

## Sign-off

This document is complete only when every `Result` row is filled in with a console-read value
and a named verifier.

| Role                | Name | Date | Signature |
| ------------------- | ---- | ---- | --------- |
| Verified by         | —    | —    | —         |
| Reviewed by (legal) | —    | —    | —         |
