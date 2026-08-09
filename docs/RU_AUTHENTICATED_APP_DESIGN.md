# RU authenticated Liqvia — design only

**Date:** 2026-08-10 · **Status: DESIGN ONLY. DO NOT IMPLEMENT.**

This document exists so the lead-plane migration is built without foreclosing the authenticated
application, and so nobody mistakes a working Russian lead funnel for a working Russian financial
product. **Building any of this requires separate approval.**

---

## 1. What is being deferred, and why the distinction matters

| | RU lead plane *(this migration)* | RU authenticated app *(deferred)* |
|---|---|---|
| Data | Name, email, phone, company, free-text comment | Bank statements, payroll, ledgers, contracts, counterparties |
| Volume per subject | One row | Thousands of rows, ongoing |
| Tables | 2 | ~30 |
| Auth | None | Full — accounts, sessions, roles, tenancy |
| AI | None | `AiPrivacyGateway` → provider |
| Uploads | None | Core to the product |
| Blast radius of a mistake | One consultation request | A company's entire financial position |

> **Russian lead localisation readiness is not Russian financial-data readiness.** Moving two
> marketing tables to Yandex Cloud says nothing about the safety of processing Russian companies'
> bank data. The gap between them is roughly the whole product.

---

## 2. Proposed shape: one codebase, two deployments

The same principle as the lead plane, extended.

```
        ┌────────────────────────────────┐        ┌────────────────────────────────┐
        │ GLOBAL DEPLOYMENT              │        │ RU DEPLOYMENT                  │
        │ Render                         │        │ Yandex Cloud                   │
        │ Global PostgreSQL (Oregon)     │        │ RU PostgreSQL (ru-central1)    │
        │                                │        │                                │
        │ existing financial app         │        │ same application code          │
        │ deterministic forecast engine  │        │ deterministic forecast engine  │
        │ AiPrivacyGateway → OpenAI      │        │ AiPrivacyGateway → approved    │
        │                                │        │   AI mode (see §5)             │
        └────────────────────────────────┘        └────────────────────────────────┘
                        ▲                                          ▲
                        │  LIQVIA_DATA_PLANE=global                │  LIQVIA_DATA_PLANE=ru
                        └──────────── one repository ──────────────┘
```

**One codebase remains right at this scale.** The financial logic must be *identical* in both planes
— a forecast that differs by jurisdiction is a bug, and two codebases guarantee that bug eventually.
The differences are configuration: which database, which AI mode, which locale defaults.

**Do not fork into a separate "Liqvia Russia" repository.** The consent registry, redaction helpers
and residency guard are exactly the components that must not drift, and a fork guarantees they will.

---

## 3. The deterministic financial engine

Forecasting, scenarios, budgets and reconciliation are **deterministic and local**. They run inside
whichever plane holds the data and require no external call.

This is the most important property the RU deployment inherits: **the core product works with no
outbound network dependency.** A Russian customer's financial data can be processed end to end
without leaving Russian infrastructure. That is what makes an RU deployment feasible at all — a
product that needed a foreign API to compute a forecast could not be localised by moving a database.

---

## 4. What would have to be built

Not a migration — a second production environment for a financial product.

| Area | Work |
|---|---|
| Auth | Sessions, password reset (needs RU-resident SMTP), roles, tenancy isolation |
| Schema | ~30 tables, RU migration lineage independent of global |
| Uploads | File ingest, parsing, **`UploadBatch.rowSnapshot` retention decided first** — see §6 |
| Storage | Object Storage for uploads; encryption and retention |
| AI | An approved mode — see §5 |
| Email | RU-resident SMTP for password reset and notifications |
| Observability | Logging, metrics, alerting, all in-region |
| Backup/DR | Tested restore for financial data, not just leads |
| Access control | Break-glass, audit, segregation of duties |
| Support | Who troubleshoots Russian customer data, from where, under what authority |

**Estimate honestly:** this is a programme of work, not a sprint. The lead plane is two tables and a
form; this is the product.

---

## 5. AI in the RU plane — three options, none chosen

`AiPrivacyGateway` already ensures no raw financial data or counterparty name reaches a provider:
a schema rejecting identifying keys, counterparty pseudonymisation, free-text redaction, and a
single reviewable adapter behind a lint + test boundary.

| Option | Description | Assessment |
|---|---|---|
| **A. No AI in the RU plane** | Deterministic engine only; AI features hidden | **Safest.** The product's core value is deterministic. Ship this first |
| **B. Gateway → OpenAI, as global** | Pseudonymised aggregates cross the border | Requires legal analysis of whether the gateway's output is still personal data. **Do not assume it is not** |
| **C. Gateway → RU-resident model** | e.g. YandexGPT behind the same gateway | Keeps everything in-region; adds a new processor and a new adapter to review |

**Recommendation: start with A.** It requires no legal determination, no new processor, and no new
adapter. B and C are additive decisions that can be made later with evidence, rather than
constraints designed in at the start.

**Whichever is chosen, the gateway must not be weakened.** It is the only thing standing between a
financial application and a provider's logs.

---

## 6. `UploadBatch.rowSnapshot` (Phase U)

**Not addressed by this migration, and deliberately still open.**

`rowSnapshot` is a `Json?` column holding a verbatim copy of uploaded spreadsheet rows — bank
transactions, payroll lines, ledgers. It has no defined retention period. The finding is **global and
remains open**; moving the lead plane neither fixes nor worsens it.

For the RU lead plane the position is simple: `UploadBatch` is not copied, there is no upload
feature, so the issue cannot recur.

> **Precondition for any RU authenticated app:** `rowSnapshot` gets its own retention decision
> **before** the RU app ingests a single file, not after. Retrofitting retention onto an existing
> store of Russian payroll and bank data is materially harder than deciding it up front — and the
> data in question is the most sensitive the product ever touches.

---

## 7. Raw financial data — explicitly not enabled

Do **not** enable unrestricted Russian bank-statement uploads, payroll files, customer or supplier
ledgers, contracts or PDFs merely because the lead database moved to Yandex Cloud.

A plausible intermediate step, if a Russian pilot is wanted before the full app:

| Stage | Data | Status |
|---|---|---|
| 1. Lead capture | Contact details | **This migration** |
| 2. Aggregated pilot | Manually prepared aggregates — totals, ageing buckets, no counterparty names, no transaction lines | **CONDITIONAL** — needs its own review |
| 3. Raw financial uploads | Statements, payroll, ledgers | **NO-GO** until §4 is built and reviewed |
| 4. Full authenticated app | Everything | **DEFERRED** |

Stage 2 is worth considering because it tests demand without accepting raw financial data — but it
is a separate decision with its own legal review, not an extension of stage 1.

---

## 8. Corporate, sanctions and operator questions

Everything in `RU_YANDEX_CLOUD_ARCHITECTURE.md` §7 applies here **with greater force**: a permanent
Russian financial-services footprint raises questions a marketing funnel does not — regulatory
authorisation, customer-money handling, cross-border support, foreign staff access to Russian
financial data, and sanctions exposure of the contracting and banking path.

> **LEGAL / COMPLIANCE REVIEW REQUIRED before any of this is treated as commercially live.**
> These are not solvable in code, and no amount of correct engineering substitutes for them.

---

## 9. Decision

**DEFERRED.** No implementation work. The lead-plane migration is designed so that this remains
possible — one codebase, plane-aware configuration, a residency guard that already understands the
concept — without any of it being started.

Revisit when: the RU lead funnel has run long enough to show real demand; the legal questions in §8
have documented answers; and there is appetite for the programme in §4.
