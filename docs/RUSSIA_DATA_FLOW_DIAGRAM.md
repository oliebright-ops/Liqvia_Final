# Russia Data Residency — Data Flows: Current and Target

**Companion to** `docs/RUSSIA_DATA_ARCHITECTURE_AUDIT.md`.
**Status:** Current flows are verified against source. Target flows are a **proposal** — nothing here is implemented.

---

## Part 1 — Current state

### 1.1 Current end-to-end architecture (as deployed today)

```mermaid
flowchart TB
    subgraph Client["Browser — any tenant, any country"]
        UI["Next.js 15 App Router UI"]
        LP["liqvia.info landing (RU)"]
    end

    subgraph Render["Render.com — ONE web service, ONE region (region UNVERIFIED)"]
        SRV["frontend/server/index.ts<br/>Next.js + NestJS in ONE process, port 3000"]
        NEST["NestJS /api/*"]
        ENG["Deterministic Financial Engine<br/>forecast · runway · AR/AP · scenarios"]
        SRV --> NEST --> ENG
    end

    DB[("Render PostgreSQL 'liqvia2-db'<br/>plan: free · region UNVERIFIED<br/>ALL tenants, ALL countries")]
    LOGS["Render stdout/stderr logs<br/>contains email addresses"]

    OAI["OpenAI api.openai.com<br/>UNITED STATES"]
    YM["Yandex Metrica<br/>counter 111417446 · RUSSIA"]
    SMTP["SMTP provider<br/>region UNVERIFIED"]

    UI --> SRV
    LP --> SRV
    LP -.->|"behaviour, IP, cookies"| YM
    NEST --> DB
    NEST --> LOGS
    NEST -->|"password reset"| SMTP
    NEST ==>|"RAW customer names,<br/>supplier names,<br/>bank narratives,<br/>PDF text, upload rows"| OAI

    style OAI fill:#ffdddd,stroke:#cc0000,stroke-width:3px
    style DB fill:#ffdddd,stroke:#cc0000,stroke-width:2px
    style LOGS fill:#fff3cd,stroke:#cc8800
    style YM fill:#fff3cd,stroke:#cc8800
```

**Read this diagram as:** there is no branch point anywhere. Every tenant, RU or not, follows one path into one database, and AI features add a second, unfiltered path to the United States.

### 1.2 Personal-data entry points (brief §4)

Every endpoint and form in the repository that accepts data in the brief's categories, and where each value goes.

| #   | Entry point                                            | Fields accepted                                                                             | Where it lands                                                                       | Reaches AI?                                 |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| E1  | `POST /api/auth/register` (`/register` page)           | `name`, `email`, `password`                                                                 | `UserProfile.name`, `.email`, `.passwordHash` (bcrypt, 10 rounds)                    | No                                          |
| E2  | `POST /api/auth/login`                                 | `email`, `password`                                                                         | Compared against `UserProfile`; email propagated to `UserCompanyLink.email`          | No                                          |
| E3  | `POST /api/auth/forgot-password`                       | `email`                                                                                     | Reset token hash on `UserProfile`; **email address written to logs** on SMTP failure | No                                          |
| E4  | `POST /api/cash-os-leads` (RU landing form)            | `name`, `companyName`, `phone`, `email`, `employeeCount`, `industry`, `comment` (free text) | `CashOsLead` table in the **global** DB                                              | No                                          |
| E5  | `POST /api/onboarding/*`                               | company `name`, bank account `name` + `accountNumberMasked`, invited user `name` + `email`  | `Company`, `BankAccount`, `UserCompanyLink`                                          | Indirectly — account names enter AI context |
| E6  | `POST /api/settings/*`                                 | company `name`, user `name`/`email`, chart-of-account names                                 | `Company`, `UserProfile`, `ChartOfAccount`                                           | Company name enters AI context              |
| E7  | `POST /api/uploads/validate` + `/import`               | Entire uploaded file (see §1.3)                                                             | `UploadBatch.rowSnapshot` + domain tables                                            | Yes — via context                           |
| E8  | `POST /api/uploads/ai/normalize` (single + multi-file) | Entire uploaded file, incl. PDF                                                             | Response only; **8 raw rows / 12k chars of PDF text sent to OpenAI**                 | **Yes — directly**                          |
| E9  | `POST /api/ai/chat`, `/api/ai/insight`                 | User's free-text question                                                                   | `AiInsight.context.lastUserMessage`                                                  | **Yes — directly**                          |
| E10 | `POST /api/decision-centre/*`                          | User's free-text business question                                                          | `AiInsight.context.question`                                                         | **Yes — directly**                          |
| E11 | `POST /api/recurring-obligations`                      | Obligation `name` (free text, often a payee)                                                | `RecurringObligation.name`                                                           | **Yes — via context**                       |
| E12 | `POST /api/bank-accounts`, `/api/ledger`               | Account names, transaction `description`                                                    | `BankAccount`, `CashMovement.description`                                            | **Yes — via context**                       |
| E13 | `POST /api/scenarios`                                  | Scenario `name` (free text)                                                                 | `Scenario.name`                                                                      | Via scenario summary                        |

**Identity-bearing columns in the schema:** `UserProfile.name/email`, `UserCompanyLink.email`, `CashOsLead.name/email/phone/comment`, `Receivable.customerName`, `Payable.supplierName`, `CashMovement.description`, `BankAccount.name/accountNumberMasked`, `RecurringObligation.name`, `ChartOfAccount.name`, `UploadBatch.fileName/rowSnapshot`, `AiInsight.content/context`.

**Not collected anywhere:** home address, passport/ID number, TIN/INN, date of birth, full bank account number (masked only), card data, per-employee salary rows _as a schema concept_. Note the caveat below.

> **Caveat that matters for RU.** Although no schema column asks for employee identity, the **AP Ageing** and **Bank Transactions** templates accept free text (`Supplier Name`, `Description`). A Russian customer uploading a payroll register or a 1С export will in practice put **employee names and individual salary amounts** into those free-text fields. The schema does not prevent it, validation does not detect it, and the AI context then forwards it to OpenAI. This is the practical mechanism by which employee-level personal data would leak.

### 1.3 File-import pipeline (brief §5)

Supported formats: **CSV, XLS, XLSX, PDF**. Supported templates: `trial_balance`, `ar_ageing`, `ap_ageing`, `bank_balances`, `bank_transactions`, `prior_period_budget`, `rolling_budget`, `budget` (legacy), `weekly_actuals`.

```mermaid
flowchart TD
    B["Browser — user selects CSV/XLS/XLSX/PDF"]
    API["POST /api/uploads/... (multipart)<br/>upload.controller.ts"]
    MEM["Multer MEMORY storage — RAM buffer only<br/>NO disk, NO /tmp, NO object storage"]

    PDF["pdf-extract.ts → text + tableCsv"]
    XLS["spreadsheetToCsvString()"]
    NORM["normalizeAiUploadCsv() — deterministic rules"]

    AIMAP{"confidence low<br/>or rowCount 0?"}
    OAI1["OpenAI — inferMappingWithOpenAi<br/>SENDS 8 RAW DATA ROWS"]
    OAI2["OpenAI — inferCsvFromPdfTextWithOpenAi<br/>SENDS 12,000 CHARS RAW PDF TEXT"]

    VAL["validateUpload() — schema + business rules"]
    IMP["upload-import.service.ts"]
    SNAP[("UploadBatch.rowSnapshot<br/>VERBATIM ROWS, no expiry")]
    DOM[("Receivable / Payable / CashMovement /<br/>WeeklyActual / BudgetLine")]
    ENG["Deterministic engine<br/>13-week forecast · runway · AR/AP"]
    CTX["ai-data.service.ts buildContext()"]
    OAI3["OpenAI — full context JSON<br/>customerName · supplierName · descriptions"]
    INS[("AiInsight.context — persisted")]
    BKP[("Render Postgres backup — location UNVERIFIED")]

    B --> API --> MEM
    MEM -->|PDF| PDF
    MEM -->|XLS/XLSX/CSV| XLS
    PDF -->|"low confidence"| OAI2
    OAI2 --> NORM
    PDF --> NORM
    XLS --> NORM
    NORM --> AIMAP
    AIMAP -->|yes| OAI1 --> NORM
    AIMAP -->|no| VAL
    NORM --> VAL --> IMP
    IMP --> SNAP
    IMP --> DOM
    DOM --> ENG
    DOM --> CTX --> OAI3 --> INS
    SNAP --> BKP
    DOM --> BKP

    style OAI1 fill:#ffdddd,stroke:#cc0000,stroke-width:3px
    style OAI2 fill:#ffdddd,stroke:#cc0000,stroke-width:3px
    style OAI3 fill:#ffdddd,stroke:#cc0000,stroke-width:3px
    style SNAP fill:#ffdddd,stroke:#cc0000
    style MEM fill:#d4edda,stroke:#28a745
```

#### Stage-by-stage verification

| Stage                 | Verified behaviour                                                                                                                                             | Residency verdict |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Browser → API         | Direct multipart to Liqvia's own origin. **No signed-URL upload to any third party.**                                                                          | **GREEN**         |
| Temporary storage     | Multer memory storage — buffer in process RAM, garbage-collected after the request. **No disk, no `/tmp`, no container volume, no worker storage.**            | **GREEN**         |
| Parser                | `pdf-parse` (in-process), spreadsheet parser (in-process) — both local, no network                                                                             | **GREEN**         |
| **AI mapping assist** | Fires when rule-based confidence is `low`/`rowCount 0`, **or** for any non-`bank_transactions` template or PDF that isn't `high` confidence. Sends 8 raw rows. | **RED**           |
| **AI PDF extraction** | Fires when PDF parsing confidence is `low`. Sends 12,000 raw characters.                                                                                       | **RED**           |
| Database              | `rowSnapshot` stores rows verbatim, indefinitely                                                                                                               | **RED**           |
| Forecast engine       | Fully deterministic, no network calls                                                                                                                          | **GREEN**         |
| Logs                  | Only error strings and counts today; **no redaction policy** to keep it that way                                                                               | **YELLOW**        |
| AI context            | Full identity-bearing JSON to OpenAI on every AI feature                                                                                                       | **RED**           |
| Backup                | Follows Render Postgres; location unverified                                                                                                                   | **YELLOW**        |

**Direct answer to the brief's question — "can raw data reach foreign AI services?"**
**Yes, by three independent paths**, and two of them fire automatically without any user action beyond uploading a file.

---

## Part 2 — Target state (proposal)

### 2.1 Target architecture

```mermaid
flowchart TB
    subgraph Client["Browser — same UI, same product for every tenant"]
        UI["Next.js UI (unchanged, single codebase)"]
    end

    TR["TenantRegionResolver<br/>reads tenant.data_region from JWT/tenant record"]
    DPR{"DataPlaneRouter<br/>getDataPlane(tenant)"}

    subgraph GLOBAL["GLOBAL Data Plane (existing — unchanged)"]
        GAPI["Global API"]
        GDB[("Global PostgreSQL")]
        GST["Global Storage (if introduced)"]
        GLOG["Global Logs"]
    end

    subgraph RU["RU Data Plane (new)"]
        RAPI["RU API — RU-hosted deployment"]
        RDB[("RU PostgreSQL — RU region")]
        RST["RU Object Storage — RU region"]
        RLOG["RU Logs — RU region"]
        RBKP[("RU Backups + PITR — RU region")]
    end

    ENG["Liqvia Deterministic Financial Engine<br/>SAME CODE both planes — source of truth"]
    GW["AI Privacy Gateway<br/>aiGateway.generate()<br/>ALLOWLIST · DEFAULT DENY · aggregate-first"]
    AP{"AIProvider abstraction"}
    P1["GLOBAL_OPENAI"]
    P2["SANITISED_EXTERNAL_AI"]
    P3["RU_LOCAL_AI"]
    P4["AI_DISABLED (RU default)"]

    UI --> TR --> DPR
    DPR -->|GLOBAL| GAPI
    DPR -->|RU| RAPI
    DPR -.->|"RU plane down:<br/>FAIL CLOSED — never falls back"| X(["503 temporarily unavailable<br/>+ non-sensitive error log"])

    GAPI --> GDB & GST & GLOG
    RAPI --> RDB & RST & RLOG
    RDB --> RBKP

    GAPI --> ENG
    RAPI --> ENG
    ENG -->|"CALCULATED, AGGREGATED metrics only"| GW
    GW --> AP
    AP --> P1 & P2 & P3 & P4

    style X fill:#ffdddd,stroke:#cc0000,stroke-width:2px
    style GW fill:#d4edda,stroke:#28a745,stroke-width:3px
    style ENG fill:#d4edda,stroke:#28a745,stroke-width:2px
    style RU fill:#e7f0ff,stroke:#0056b3
```

**Design invariants this diagram encodes:**

1. **One codebase, one product.** The UI, the engine and the business logic are shared. Only the data plane differs.
2. **Routing is centralised.** `if (country === 'RU')` appears in exactly one place — `DataPlaneRouter` — not scattered through features.
3. **The engine stays deterministic and stays upstream of AI.** AI never calculates; it receives computed outputs.
4. **The gateway is the only exit to any LLM.** No feature may call a provider directly.
5. **Fail closed.** A RU plane outage returns 503. It never resolves to the global plane.

### 2.2 AI Privacy Gateway — request lifecycle

```mermaid
flowchart TD
    F["Feature calls aiGateway.generate({tenant, purpose, metrics})"]
    R{"tenant.data_region"}
    G["GLOBAL path — existing behaviour preserved"]
    M{"RU_AI_MODE"}
    D["AI_DISABLED → return deterministic rule-based output<br/>(already exists for every feature today)"]
    A["AGGREGATED_EXTERNAL"]
    L["RU_LOCAL_AI"]
    ALLOW["Allowlist filter — DEFAULT DENY<br/>drop any key not explicitly approved"]
    SCAN["Leak scan — reject names, emails,<br/>phones, free-text descriptions, raw rows"]
    FAIL(["REJECT + fail closed<br/>log error_code only"])
    SEND["Send approved metrics only"]

    F --> R
    R -->|GLOBAL| G
    R -->|RU| M
    M -->|DISABLED default| D
    M -->|AGGREGATED_EXTERNAL| ALLOW
    M -->|LOCAL| L
    ALLOW --> SCAN
    SCAN -->|violation| FAIL
    SCAN -->|clean| SEND

    style FAIL fill:#ffdddd,stroke:#cc0000,stroke-width:2px
    style D fill:#d4edda,stroke:#28a745
    style ALLOW fill:#d4edda,stroke:#28a745,stroke-width:2px
```

**RU allowlist — the only fields permitted outbound** (brief §7):

`currency` · `forecast_horizon_weeks` · `opening_cash` · `weekly_opening_cash` · `weekly_closing_cash` · `aggregated_cash_inflows` · `aggregated_cash_outflows` · `total_receivables` · `total_payables` · `total_payroll` · `total_tax_obligations` · `total_rent` · `total_debt_repayment` · `cash_runway_weeks` · `liquidity_threshold` · `scenario_pct_assumption` · `forecast_confidence_score`

**Explicitly denied, and unreachable because the default is deny:** person/employee names · email · phone · address · bank account numbers · TIN/INN · passport data · individual salaries · free-text transaction descriptions · raw bank transactions · raw documents · raw spreadsheets · customer and supplier contact details · uploaded file contents · user free text.

### 2.3 Aggregation before AI (brief §8)

The transformation the gateway must enforce:

| Today (sent verbatim)                                                  | Under the gateway                         |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `payablesDetail: [{counterparty: "ООО Ромашка", amount: 480000}, …]`   | `total_payables: 1_240_000`               |
| Payroll rows: `Иван — 180000`, `Анна — 210000`, `Сергей — 175000`      | `total_payroll: 565_000`                  |
| `cashTransactions[].description: "Оплата по договору №14 Петров И.И."` | `aggregated_cash_outflows: 3_120_000`     |
| `companyName: "ООО Ромашка"`                                           | omitted — tenant referenced as `ru_23531` |

The AI's job is unchanged: **explain the numbers the deterministic engine already produced.** It never needed identities to do that.

### 2.4 Logging policy (brief §14)

```json
{
  "tenant": "ru_23531",
  "operation": "AP_IMPORT",
  "rows": 482,
  "status": "FAILED",
  "error_code": "INVALID_DATE_FORMAT",
  "request_id": "req_01J8X…"
}
```

Permitted keys only: `tenant_internal_id` · `operation_type` · `row_count` · `request_id` · `error_code` · `duration_ms` · `status`.
Never logged: request bodies · uploaded rows · document contents · transaction descriptions · names · emails · phones · account numbers · AI prompts or responses containing customer data · passwords · access and refresh tokens.

**Immediate fix required regardless of RU work:** `backend/src/auth/mail.service.ts:38` and `:63` log recipient email addresses.

---

## Part 3 — Cross-reference

| Brief requirement          | Current state                                     | Target                            |
| -------------------------- | ------------------------------------------------- | --------------------------------- |
| §6 AI Privacy Gateway      | 7 direct OpenAI call sites, no gateway            | Single `aiGateway.generate()`     |
| §7 RU allowlist            | None — everything is sent                         | Default-deny allowlist            |
| §8 Aggregate before AI     | Individual rows sent                              | Totals only                       |
| §9 `data_region` field     | Does not exist                                    | Immutable tenant column           |
| §10 DataPlane routing      | Does not exist                                    | `DataPlaneRouter`                 |
| §11 Fail closed            | No RU plane, so no fallback logic yet             | 503, never global fallback        |
| §12 RU file storage        | No object storage at all                          | RU object storage when introduced |
| §13 Temp files             | **Already clean** — memory only                   | Preserve this property            |
| §14 Log redaction          | No policy; emails logged                          | Structured allowlist logger       |
| §15 Backups                | Unverified                                        | RU-region backups + PITR          |
| §16 Dev access             | Uncontrolled                                      | Synthetic-data-only policy        |
| §17 Pilot mode             | No flag                                           | `RU_CONTROLLED_PILOT_MODE`        |
| §18 RU safe template       | Templates request `Customer Name`/`Supplier Name` | Counterparty-code template        |
| §22 Deterministic engine   | **Already correct — do not change**               | Unchanged                         |
| §23 AIProvider abstraction | None                                              | 4-mode abstraction                |
