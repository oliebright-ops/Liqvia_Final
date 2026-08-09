# RU Yandex Cloud target architecture (Phases D, E, S)

**Date:** 2026-08-10 · **Status: DESIGN ONLY — no Yandex Cloud resource has been created.**

Creating billable Yandex Cloud resources is a **STOP CONDITION**. This document is what you approve
*before* anything is provisioned.

---

## 0. The principle this design is built on

> **"Hosted on Yandex Cloud" is not "152-FZ compliant."**

Yandex Cloud can provide infrastructure physically located in Russia, and offers services intended
for personal-data workloads. It cannot supply: a lawful basis, correct consent wording, a defensible
retention period, least-privilege access, an accurate processing record, or an application that does
not leak personal data into logs and analytics. **All of that remains Liqvia's.**

Every statement in this document is about *where bytes sit and who can reach them*. Nothing here is
a compliance conclusion. **LEGAL REVIEW REQUIRED.**

---

## 1. Target data flow

```
                    Yandex Direct  ──────────────┐
                                                 │ (non-identifying campaign IDs)
                                                 ▼
   Russian visitor  ─────────────────────►  liqvia.info
                                                 │
                        ┌────────────────────────┴───────────────────────┐
                        │                                                │
                        ▼                                                ▼
              Yandex Metrica (RU)                        RU application runtime
              analytics only —                           Yandex Compute Cloud
              NEVER the lead store                       (Next.js + NestJS, one process)
                                                                  │
                                                       private subnet, no public DB route
                                                                  │
                                                                  ▼
                                                   Managed Service for PostgreSQL (RU)
                                                   ├── CashOsLead
                                                   └── ConsentRecord
                                                                  │
                                                                  ▼
                                                   Automated backups (same RU region)

   Secrets ──► Yandex Lockbox          Logs ──► Cloud Logging (redacted, RU)
                                       Admin actions ──► Audit Trails (RU)
```

**Nothing crosses out of Russia on the lead path.** The global Render deployment continues to serve
the authenticated Liqvia product, unchanged, and never receives a Russian lead.

---

## 2. One codebase, two deployments (Phase E)

Liqvia runs as a single process (Next.js UI + NestJS API). The RU plane keeps that shape.

| | Global deployment | RU lead deployment |
|---|---|---|
| Host | Render (`liqvia-landing`, `liqvia2`) | Yandex Compute Cloud |
| Database | Render PostgreSQL, Oregon | Managed PostgreSQL, Russia |
| Serves | Full authenticated product | `liqvia.info` marketing + lead capture |
| Routes enabled | All | `/`, `/cash-operating-system`, `/privacy`, `/consent`, `POST /api/cash-os-leads`, `/_next/*` |
| Prisma schema | Full 30-table schema | **2-table RU schema** — see `RU_MINIMUM_SCHEMA.md` |
| AI | `AiPrivacyGateway` → OpenAI | **No AI. No provider configured** |
| SMTP | Password reset only | None at cutover — see `RU_SMTP_DATA_FLOW.md` |

### Explicitly rejected alternatives

| Rejected | Why |
|---|---|
| **Microservices for Russia** | The RU plane is one form and two tables. A service mesh for that is cost and attack surface with no benefit |
| **A forked "Liqvia Russia" repository** | Guarantees drift. The consent registry, redaction and residency guard must stay in one place or they will diverge exactly where it matters |
| **Copying the full database** | See `RU_MINIMUM_SCHEMA.md` §2. Would replicate bank data and other customers' financial records into a new jurisdiction on the back of a marketing change |
| **Object Storage / queues / cache in v1** | Not required by the funnel. Every added service is another store to secure, back up, retain and delete |

### How one codebase yields two behaviours

The RU deployment differs by **configuration**, not by code branch:

| Variable | Global | RU |
|---|---|---|
| `LIQVIA_DATA_PLANE` | `global` | `ru` |
| `DATABASE_URL` | Render Oregon | Yandex Managed PostgreSQL |
| `OPENAI_API_KEY` | set | **unset** |
| `SMTP_HOST` | set | **unset** |
| `NEXT_PUBLIC_YANDEX_METRICA_ID` | — | `111417446` |

`LIQVIA_DATA_PLANE` drives the **fail-closed residency guard** (Phase X) — see
`RU_PRODUCTION_DATA_FLOW.md` §X and `backend/src/residency/`. It is the mechanism that makes a
misconfigured RU deployment *stop* rather than quietly write Russian personal data to Oregon.

---

## 3. Yandex Cloud services — needed, and not needed

### Required

| Service | Purpose | Justification |
|---|---|---|
| **Managed Service for PostgreSQL** | `CashOsLead`, `ConsentRecord` | The residency requirement itself. Managed gives backups, patching and PITR that a self-run VM would not |
| **Compute Cloud** | Application runtime | Smallest viable instance. A landing page and one POST endpoint |
| **Virtual Private Cloud** | Private subnet between app and database | The database must not be reachable from the internet — Phase S |
| **Lockbox** | DB credentials, application secrets | Phase R. Keeps secrets out of Git, images and environment dumps |
| **Cloud Logging** | Application logs, in Russia | Logs may incidentally contain personal data despite redaction; they must not leave the jurisdiction |
| **Audit Trails** | Who changed infrastructure, who accessed what | Phase T. Attributability is the point |

### Deliberately excluded from v1

| Service | Why not |
|---|---|
| **Object Storage** | Nothing to store. No uploads, no attachments in the lead plane. Add only when a concrete need appears |
| **Managed Kubernetes** | Enormously disproportionate to one process |
| **Message queue** | No asynchronous work |
| **Managed Redis** | No session or cache requirement — the lead plane is stateless |
| **YandexGPT / any AI** | Phase V. The RU lead path has no reason to call a model, and adding one would create a new processor of Russian personal data |
| **API Gateway / Serverless Containers** | Reasonable alternative to Compute Cloud; adds a second deployment model to reason about. Revisit if instance management proves burdensome |

**Region:** a Russian region (`ru-central1`), zones to be selected at provisioning. The exact zone
selection, encryption settings and backup retention are recorded in `RU_DATABASE_CONFIGURATION.md`
and **must be read from the actual console at creation time**, not assumed from documentation.

---

## 4. Networking (Phase S)

```
   Internet
      │  443 only
      ▼
 ┌─────────────────────────────────────────────┐
 │ VPC  ru-central1                            │
 │                                             │
 │  ┌───────────────────┐   ┌────────────────┐ │
 │  │ public subnet     │   │ private subnet │ │
 │  │  app instance     │──►│  PostgreSQL    │ │
 │  │  SG: 443 in       │   │  SG: 6432 in   │ │
 │  │       from world  │   │   from app SG  │ │
 │  └───────────────────┘   │  NO public IP  │ │
 │                          └────────────────┘ │
 └─────────────────────────────────────────────┘
```

Rules:

1. **The database has no public IP and no "allow all" rule.** Yandex Managed PostgreSQL can be
   created with public access — do not.
2. Its security group accepts the PostgreSQL port **only from the application's security group**,
   by group reference, never by CIDR.
3. The application accepts `443` only. No SSH from the world; administrative access via OS Login /
   bastion, not an open port.
4. **TLS to the database is mandatory** — Managed PostgreSQL provides a CA certificate. Prisma must
   verify it (`sslmode=verify-full`), not merely encrypt.

> **The rule that matters:** developer convenience must not become production exposure. "Temporarily"
> opening the database to a laptop is how the finding in `RU_CURRENT_LEAD_DATA_FLOW.md` §8 came about
> on the global side. Local development uses `docker-compose.yml` and synthetic data — never the RU
> database.

---

## 4.1 Verification evidence — U1 (web-service region)

**Verification date:** 2026-08-10 · **Method:** authenticated, read-only Yandex Cloud API query.
No token or credential is recorded here, and none may be added to this repository.

| Fact | Value |
|---|---|
| Instance | `liqvia-ru-app` (`fhmd7dqno1g3u84n8jad`) |
| **Zone** | **`ru-central1-a`** |
| Status | `RUNNING` at verification time |
| Public IPv4 | `158.160.44.137` |

Three independent observations agree, which is what makes this evidence rather than an assertion:

1. `liqvia.info` resolves to `158.160.44.137` (checked from outside the cloud).
2. That address falls in `158.160.0.0/16` — RIPE `inetnum` netname **`RU-YANDEXCLOUD`**, country
   **RU**.
3. The instance holding that address reports its own `zone_id` as `ru-central1-a`.

Observation 2 alone would not have been enough: RIPE country is registration data for an entire
`/16`, not a property of the resource. It is the third that closes U1, and the first that ties the
resource to the domain a visitor actually types.

Database-side evidence (U2) and backup evidence (U3) are in
[`RU_DATABASE_CONFIGURATION.md`](RU_DATABASE_CONFIGURATION.md) §4.2.

## 5. What stays in the global deployment

Unchanged and untouched by this work:

- the authenticated Liqvia application and every one of its 30 tables;
- the deterministic financial engine (forecasts, scenarios, budgets);
- `AiPrivacyGateway` and its OpenAI provider;
- all existing global customers' data;
- Render, its database, and `liqvia.info`'s *current* serving path until cutover.

**The global product must not change because of this migration.** Any change to global behaviour is
out of scope and a signal that the boundary has been drawn in the wrong place.

---

## 6. What this architecture does *not* give you

Stated plainly, so the design is not oversold:

1. **It is not compliance.** It is data residency for one funnel. Lawful basis, consent wording,
   retention, subject-rights handling and the operator's notification obligations are all
   independent, all outstanding, and all **LEGAL REVIEW REQUIRED**.
2. **It does not cover the authenticated product.** Russian users of the full financial application
   would still be served from Oregon. See `RU_AUTHENTICATED_APP_DESIGN.md` — design only.
3. **It does not address the corporate questions.** Contracting entity, billing path, banking,
   sanctions exposure, foreign developer access and cross-border administration are *not* solvable in
   code. See §7.
4. **It does not make Metrica part of the compliance story.** Metrica is analytics. It is never the
   lead store, and its being Russian does not localise anything.

---

## 7. Sanctions / corporate / operator gate

Before a permanent Russian operating footprint is treated as commercially live, the following need
documented review. **None of them is an engineering task, and none can be closed by shipping code:**

- operator identity and any operator-notification obligation;
- corporate/entity structure and which entity contracts with Yandex Cloud;
- billing and payment path for Yandex Cloud and Yandex Direct;
- banking arrangements;
- sanctions implications of paying a Russian cloud provider;
- cross-border administration of Russian infrastructure;
- foreign developer access to Russian personal data;
- international processors remaining in the path (Cloudflare, IONOS, GitHub);
- any future AI provider;
- the future authenticated application.

> **LEGAL / COMPLIANCE REVIEW REQUIRED.** Do not make public statements that Liqvia is compliant
> with 152-FZ, and do not make public data-residency claims, on the basis of this document.

---

## 8. Provisioning order (when approved)

Nothing below has been executed.

1. Create the folder, VPC and subnets. **No resources yet.**
2. Create Managed PostgreSQL — private, TLS-only. Record actual settings into
   `RU_DATABASE_CONFIGURATION.md`.
3. Create Lockbox secrets; grant the app's service account read on those secrets only.
4. Create the Compute instance; attach the service account; no database credentials in user-data.
5. Enable Cloud Logging and Audit Trails **before** the first deployment, so the first deployment is
   itself audited.
6. Apply the **RU-only** Prisma schema (2 tables). Verify `_prisma_migrations` contains only those
   migrations — see `RU_MINIMUM_SCHEMA.md` §2.1.
7. Deploy with `LIQVIA_DATA_PLANE=ru`.
8. Run the synthetic verification in `RU_CUTOVER_PLAN.md` §3 — **all 16 checks** — before any real
   traffic.

Steps 2–7 create billable resources and **require owner approval**.
