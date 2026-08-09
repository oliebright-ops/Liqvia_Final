# RU minimum schema — what the Russian lead plane actually needs

**Date:** 2026-08-10 · **Source of truth:** `backend/prisma/schema.prisma` at `fc026f8`

The production database holds **30 tables**. The Russian lead plane needs **2**.

This document exists to stop the default engineering instinct — "point Prisma at the new database
and run all the migrations" — which would replicate the entire authenticated financial application,
including other people's data, into Russian infrastructure for no reason.

---

## 1. Required tables

| Table | Purpose in the RU funnel | Required? | Personal data? | Migration needed? | Retention consideration |
|---|---|---|---|---|---|
| **`CashOsLead`** | The consultation request itself | **Yes** — it *is* the funnel | **Yes** — name, email, phone, free-text comment, employer | Schema yes; **data no** (`historical_ru_leads = 0`) | Needs a defined retention period. **Undefined today** — see §4 |
| **`ConsentRecord`** | Append-only evidence of what was agreed, and to which wording | **Yes** — a lead without evidence is not lawfully collectable | **Indirectly** — links to a lead; stores no name itself | Schema yes; **data no** (zero rows exist) | Must **outlive** the lead it refers to — see §4 |

That is the entire RU lead data plane. Two tables.

### 1.1 `CashOsLead`

```prisma
model CashOsLead {
  id            String   @id @default(cuid())
  name          String        // personal data
  role          String?       // personal data (job title)
  companyName   String        // not personal data as such; identifies employer
  phone         String?       // personal data
  email         String        // personal data
  employeeCount String?       // company attribute
  industry      String?       // company attribute
  comment       String?       // FREE TEXT — unbounded personal data risk
  source        String?       // campaign tag, currently a fixed literal
  createdAt     DateTime @default(now())

  consentRecords ConsentRecord[]
  @@index([createdAt])
}
```

**Carried over unchanged.** Two observations that are *not* changes:

- `comment` is free text. A person can type anything into it, including health, financial or
  third-party information. It cannot be validated into safety — only minimised, access-controlled and
  kept out of logs and analytics. It is the highest-risk column in the RU plane.
- `source` is currently the hard-coded literal `'cash-operating-system-landing'`. It is the natural
  home for a **non-identifying campaign ID** under Phase M. It must never receive a URL or query
  string, which would drag `yclid`/UTM values — and anything else in the address bar — into the
  database.

### 1.2 `ConsentRecord`

Carried over unchanged, including `consentTextSha256`, `textVerified`, `policyVersion` and
`acknowledgedAt`. The `onDelete: Cascade` on `cashOsLeadId` is called out in §4 because it interacts
with retention in a way that is easy to get wrong.

---

## 2. Tables that must NOT be copied

Not one of these has any role in a Russian visitor submitting a consultation request.

| Table | Why it exists | Why it stays out of the RU plane |
|---|---|---|
| `Company`, `UserProfile`, `UserCompanyLink` | Authenticated tenancy | The RU lead plane has no accounts and no login |
| `PasswordResetToken` | Auth flow | No auth ⇒ no tokens |
| `ChartOfAccount`, `JournalEntry`, `JournalLine` | Ledger | Financial data of existing global customers |
| `BankAccount`, `CashMovement` | **Bank data** | Categorically out of scope. Copying it into a new jurisdiction on the back of a marketing migration would be indefensible |
| `Receivable`, `Payable`, `ExpectedSettlement` | Working capital | Counterparty data belonging to other customers |
| `Budget`, `BudgetLine`, `WeeklyActual` | Planning | — |
| `CashForecast`, `ForecastLine`, `Scenario`, `ScenarioLine` | Forecast engine | Deterministic engine stays global — see `RU_AUTHENTICATED_APP_DESIGN.md` |
| `UploadBatch`, `UploadError` | File ingest | **See §3 — `rowSnapshot`** |
| `Alert`, `Notification`, `RecurringObligation`, `KpiSnapshot` | Product features | No authenticated product in the RU plane |
| `AiLog`, `AiInsight` | AI outputs | No AI in the RU lead path, by design (Phase V) |
| `AuditLog` | Global app audit | The RU plane gets its **own** audit trail, not a copy of the global one |
| `_prisma_migrations` | Migration ledger | **Must be independent.** A shared ledger is what causes an unrelated migration to run against the RU database |

### 2.1 The `_prisma_migrations` trap

The RU database must have its **own** migration history containing **only** the migrations that
create these two tables. Pointing `prisma migrate deploy` with the existing `migrations/` directory
at a fresh Yandex database would replay **all 30 tables**, silently defeating the entire point.

This needs a deliberate mechanism — a separate Prisma schema and migrations directory for the RU
plane, or a baseline. It is not something to leave to deployment-time discipline. Specified in
`RU_DATABASE_CONFIGURATION.md` §3.

---

## 3. `UploadBatch.rowSnapshot` (Phase U)

**Not applicable to the RU lead plane, and deliberately left unresolved.**

`UploadBatch.rowSnapshot` is a `Json?` column holding a verbatim snapshot of uploaded spreadsheet
rows — bank transactions, payroll, ledgers. It carries an outstanding **global** retention finding
(no defined lifetime, unbounded personal and financial content).

For this migration the position is simply:

- `UploadBatch` is **not** copied to Russia, so `rowSnapshot` cannot be copied either;
- the RU lead plane has no file upload, so the finding cannot recur there;
- **the global finding remains open and is not closed by this work.** Recorded here so that moving
  the lead plane does not create the impression it was addressed.

If a future authenticated RU application ingests files, `rowSnapshot` needs its own retention
decision **before** that application exists, not after. See `RU_AUTHENTICATED_APP_DESIGN.md` §6.

---

## 4. Retention — the open question

Neither table has a defined retention period. Today that is harmless (`historical_ru_leads = 0`).
From the first real lead onward it is a live obligation: personal data may not be kept indefinitely
merely because storage is cheap.

Two decisions are needed, and they are **business/legal decisions, not engineering ones**:

1. **How long is a lead kept after the enquiry is closed?** A consultation request that goes nowhere
   has no purpose justifying indefinite storage. A period of months, not years, is the shape of the
   answer.
2. **How long is consent evidence kept?** This must be **longer** than the lead. Evidence proving
   what someone agreed to is worth nothing if it is destroyed with the record it justifies.

> ### Interaction to be careful with
>
> `ConsentRecord.cashOsLeadId` has `onDelete: Cascade`. **Deleting a lead deletes its consent
> evidence.** That is correct for an erasure request — the evidence is only meaningful alongside the
> data it authorised. It is *wrong* for routine retention expiry, where the lead is discarded but the
> proof that its collection was lawful should survive.
>
> Resolving this needs a deliberate choice: either erasure and expiry use different code paths, or
> `ConsentRecord` keeps a de-identified copy of the essential facts (subject, version, hash,
> timestamp) that survives the cascade. **Do not change the cascade without deciding which.**

**LEGAL REVIEW REQUIRED** for both periods and for the erasure/expiry distinction. No retention
period has been invented here.

---

## 5. Summary

| | Count |
|---|---|
| Tables in production today | 30 |
| Tables in the RU lead plane | **2** |
| Rows to migrate | **0** |
| Personal-data columns in the RU plane | 5 (`name`, `role`, `phone`, `email`, `comment`) |
| Retention periods defined | **0 — open** |

The RU lead plane is small enough to hold in your head, and it should stay that way. Every table
added to it is a table that has to be justified, secured, backed up, retained, and eventually
deleted, in a jurisdiction where getting that wrong is expensive.
