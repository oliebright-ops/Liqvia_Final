# Russia Data Residency — Risk Register and Implementation Plan

**Status:** Proposal. No implementation has begun, per the brief's instruction not to migrate before the audit is confirmed.
**Companions:** `RUSSIA_DATA_ARCHITECTURE_AUDIT.md` (current state), `RUSSIA_DATA_FLOW_DIAGRAM.md` (flows and target architecture), `RU_MARKETING_DATA_FLOW.md` (marketing).

---

## 1. Risk register

Likelihood/impact are engineering judgements about data exposure, not legal opinions.

### RED — verified exposure

| ID     | Risk                                                                                                                    | Evidence                                                     | Impact                       | Likelihood                                            | Mitigation                                                            | Phase |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| **R1** | Customer names, supplier names and raw bank transaction descriptions transmitted to OpenAI (US) on every AI interaction | `ai-data.service.ts:103-148`, `:87-97` → `ai.service.ts:602` | Critical                     | **Certain** — occurs on every AI request today        | AI Privacy Gateway with default-deny allowlist; aggregate before send | 1     |
| **R2** | Up to 12,000 characters of raw PDF bank-statement text sent to OpenAI                                                   | `ai-upload.service.ts:367-397`                               | Critical                     | High — fires automatically on low-confidence PDFs     | Disable for RU tenants; gateway-gated for all                         | 1     |
| **R3** | Eight complete raw upload data rows sent to OpenAI                                                                      | `ai-upload.service.ts:421-434`                               | Critical                     | High — fires automatically on most non-bank templates | Send headers only, never values; gateway-gated                        | 1     |
| **R4** | Full AI context **plus the user's free-text question** persisted to `AiInsight.context` indefinitely                    | `ai.service.ts:152-160`                                      | High                         | Certain                                               | Persist only the gateway-approved payload; add retention              | 1     |
| **R5** | `UploadBatch.rowSnapshot` stores verbatim uploaded rows forever, no retention policy                                    | `upload-import.service.ts:93`                                | High                         | Certain                                               | Retention policy + RU-plane storage                                   | 3     |
| **R6** | "Data Residency Controls" advertised in 4 locales; feature does not exist                                               | `en.json:134`, `security-trust-section.tsx:15`               | High (reputational/legal)    | Certain — currently published                         | Correct or remove the copy                                            | **0** |
| **R7** | RU landing leads (name, phone, email, company, free comment) stored in the non-RU global database                       | `cash-os-leads.service.ts:34-40`                             | High                         | Certain                                               | Route RU leads to the RU plane                                        | 3     |
| **R8** | No data-region concept exists — no field, no routing, no fail-closed path                                               | whole codebase                                               | Critical (blocks everything) | Certain                                               | `data_region` + `DataPlaneRouter`                                     | 2     |
| **R9** | Consent notice references a privacy policy that has never been published; no consent record stored                      | `lead-form.tsx:191-195`; no privacy route exists             | High                         | Certain                                               | Publish policy; add checkbox + stored consent                         | **0** |

### YELLOW — unverified or policy gap

| ID      | Risk                                                                                                                            | Evidence                            | Impact | Mitigation                                 | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ | ------------------------------------------ | ----- |
| **Y1**  | Render web service and database regions unknown                                                                                 | `render.yaml` has no `region:` key  | High   | Verify in console (U1, U2)                 | **0** |
| **Y2**  | Backup location/retention unknown; `plan: free` has no PITR                                                                     | `render.yaml:6`                     | High   | Verify; upgrade plan; RU-region backups    | 0 / 3 |
| **Y3**  | Recipient email addresses written to application logs                                                                           | `mail.service.ts:38,63`             | Medium | Redact immediately; central logging policy | **0** |
| **Y4**  | SMTP provider unidentified — an unknown processor holds user emails and reset links                                             | `render.yaml:36-44` (`sync: false`) | Medium | Identify; assess region                    | 0     |
| **Y5**  | Yandex Metrica Webvisor state unverified — may be recording form input                                                          | `yandex-metrica.tsx:24-29`          | Medium | Verify in Metrica console (U8)             | **0** |
| **Y6**  | Metrica cookies set before any consent; no cookie banner                                                                        | `yandex-metrica.tsx:12-37`          | Medium | Consent gate                               | 1     |
| **Y7**  | No control preventing production data download to developer laptops                                                             | no policy in repo                   | High   | Written policy + synthetic-data-only rule  | **0** |
| **Y8**  | `docs/engineering/deployment.md` documents Clerk as the auth provider — factually wrong                                         | `deployment.md:7`                   | Low    | Correct the doc                            | **0** |
| **Y9**  | Free-text template fields (`Supplier Name`, `Description`) will in practice carry employee names and salaries from RU customers | `templates.ts:20-66`                | High   | RU safe import template + pilot mode       | 1     |
| **Y10** | Lead data has no retention limit and no erasure mechanism                                                                       | `schema.prisma:765-779`             | Medium | Retention + deletion path                  | 3     |
| **Y11** | No audit log of who accessed which tenant's data                                                                                | no `AuditLog` model exists          | Medium | `AuditLogger` service                      | 2     |

### GREEN — verified safe

| ID     | Finding                                                                       | Why it matters                                                            |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **G1** | No object storage exists (no S3/R2/GCS/Azure)                                 | Nothing to mis-region; brief §12 is currently satisfied by absence        |
| **G2** | No browser→third-party signed-URL uploads                                     | Directly answers the brief's §12 question — this leak path does not exist |
| **G3** | No files written to disk or `/tmp`; Multer memory storage only                | Brief §13 is currently satisfied — **this property must be preserved**    |
| **G4** | No cron, no queues, no Redis                                                  | No background worker leakage surface                                      |
| **G5** | No GA/Meta Pixel/Hotjar/LinkedIn on the RU landing; Metrica only, host-gated  | Brief §20 baseline is clean                                               |
| **G6** | Forecasting is already fully deterministic; AI only narrates                  | Brief §22 already satisfied — **do not change**                           |
| **G7** | Landing host-gating correctly blocks product routes from the marketing domain | Well-built isolation at the routing layer                                 |

---

## 2. Third-party processors (deliverable 6)

| Processor               | Data received                                                          | Region                        | Verified?                  |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------- | -------------------------- |
| Render.com — compute    | All requests, upload buffers, credentials                              | **Unknown** (default US-West) | No — U1                    |
| Render.com — PostgreSQL | All tenant data, user identities, RU leads                             | **Unknown**                   | No — U2                    |
| Render.com — logs       | Error strings, email addresses                                         | Follows service               | No — U5                    |
| **OpenAI**              | Counterparty names, raw bank narratives, raw PDF text, raw upload rows | **United States**             | **Yes — verified in code** |
| **Yandex (Metrica)**    | RU landing behaviour, IP, cookies                                      | **Russia**                    | **Yes — verified in code** |
| SMTP provider           | Recipient email + reset link                                           | **Unknown**                   | No — U6                    |
| GitHub Actions          | Synthetic demo data only                                               | US                            | Yes — no production data   |

No other outbound integration exists. No Xero/QuickBooks/bank-feed connector is implemented (the `ExternalSource` enum reserves the names; nothing calls out).

## 3. Physical regions (deliverable 7)

| Component          | Region                                    | Confidence                      |
| ------------------ | ----------------------------------------- | ------------------------------- |
| OpenAI API         | United States                             | **Verified** — `api.openai.com` |
| Yandex Metrica     | Russia                                    | **Verified** — `mc.yandex.ru`   |
| GitHub Actions     | United States                             | **Verified** — `ubuntu-latest`  |
| Render web service | Unknown — likely Oregon (US-West) default | **Unverified**                  |
| Render PostgreSQL  | Unknown                                   | **Unverified**                  |
| Render backups     | Unknown                                   | **Unverified**                  |
| Render logs        | Unknown                                   | **Unverified**                  |
| SMTP provider      | Unknown                                   | **Unverified**                  |
| CDN (if any)       | Unknown                                   | **Unverified**                  |

## 4. Unknowns requiring console verification (deliverable 8)

U1–U12 are enumerated in `RUSSIA_DATA_ARCHITECTURE_AUDIT.md` §16. **The four that block any customer-facing residency statement are U1 (service region), U2 (database region), U3 (backup location) and U8 (Webvisor).**

---

## 5. Implementation phases (deliverable 9)

Sequenced so that each phase delivers standalone value and nothing later depends on an unverified fact.

### Phase 0 — Truth and immediate corrections · complexity **LOW** · no architecture change

Nothing here requires the RU decision to be made.

1. Verify U1–U12 in the Render, OpenAI and Metrica consoles; record answers in the audit doc.
2. **Correct or remove the "Data Residency Controls" marketing claim** in all four locales (R6).
3. **Redact email addresses from logs** — `mail.service.ts:38,63` (Y3).
4. **Publish a privacy policy** and link it from the RU lead form and footer (R9).
5. Correct the stale Clerk reference in `docs/engineering/deployment.md` (Y8).
6. Adopt and circulate the developer-access policy: **no RU production data on developer machines; use the existing synthetic seed** (Y7).

### Phase 1 — AI Privacy Gateway · complexity **MEDIUM** · no infrastructure change

The highest-value phase. It removes the RED AI exposures **without any new infrastructure**, because the financial engine is already deterministic.

1. Create `backend/src/ai-gateway/` — `AiPrivacyGateway` with `generate({ tenant, purpose, metrics })`.
2. Implement the default-deny allowlist (17 approved metric fields) and the leak scanner (names, emails, phones, free-text descriptions, raw rows).
3. Create `AIProvider` abstraction with `GLOBAL_OPENAI` | `SANITISED_EXTERNAL_AI` | `RU_LOCAL_AI` | `AI_DISABLED`. Implement the first and last only.
4. **Refactor all 7 direct OpenAI call sites** to route through the gateway. Global tenants keep today's exact behaviour via `GLOBAL_OPENAI` — no regression.
5. Add an aggregation layer producing totals (`total_payables`, `total_payroll`, …) from detail rows.
6. Restrict what `AiInsight.context` persists to the gateway-approved payload.
7. Add a lint rule or CI grep failing the build on any new direct `api.openai.com` reference outside the gateway.
8. Build the test suite (brief §25/§26), including `ruDataResidencyBoundary.test`.

### Phase 2 — Tenant region and routing · complexity **MEDIUM**

1. Add `data_region` to `Company` (`GLOBAL` | `RU`, default `GLOBAL`, immutable after set).
2. `TenantRegionResolver` — resolves region from the tenant record, carried in the JWT claim.
3. `DataPlaneRouter` with `getDataPlane(tenant)`; `DatabaseProvider` and `StorageProvider` interfaces.
4. **Fail-closed semantics**: RU plane unavailable → 503 + safe message + non-sensitive log. Never falls back to global.
5. `AuditLogger` with the structured allowlist logging policy.
6. `RU_CONTROLLED_PILOT_MODE` flag: restrict RU tenants to the safe import template, block raw uploads, show the import instruction.
7. RU safe import template with `counterparty_code` in place of names.

### Phase 3 — RU data plane · complexity **HIGH**

Only after Phases 0–2 and a confirmed commercial decision.

1. Provision RU-region Postgres with RU-region backups and PITR.
2. Provision RU-region object storage (only if the product introduces object storage — today it has none).
3. Deploy an RU-region application instance.
4. Route RU leads to the RU plane.
5. RU-region log sink.
6. RU migration runbook and DR runbook.

> **Note on the commercial context.** `Liqvia_Funding_Residency_Roadmap.docx` in the repository root — and the `marketing/ru-campaign/` strategy documents that cite it — record that Liqvia, as a product handling banking data, has been positioned as having no appetite for Russia-linked risk, referencing a 2025 OFAC enforcement precedent. **Phase 3 commits real infrastructure spend and a jurisdictional footprint. It should not start until that tension is resolved as an explicit business decision.** Phases 0–2 are worth doing regardless: they fix false marketing claims, stop raw customer data flowing to a US AI provider, and improve the global product's privacy posture on their own merits.

---

## 6. Expected changes by folder/file (deliverable 10)

| Path                                                      | Change                                                                                     | Phase |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----- |
| `frontend/src/locales/{en,ru,es,fr}.json`                 | Correct/remove `residencyTitle`/`residencyDesc`                                            | 0     |
| `frontend/src/components/home/security-trust-section.tsx` | Drop or relabel the fourth card                                                            | 0     |
| `backend/src/auth/mail.service.ts`                        | Remove email addresses from log lines                                                      | 0     |
| `frontend/src/app/privacy/page.tsx`                       | **New** — published privacy policy                                                         | 0     |
| `docs/engineering/deployment.md`                          | Correct the Clerk reference                                                                | 0     |
| `backend/src/ai-gateway/`                                 | **New module** — gateway, allowlist, leak scanner, providers                               | 1     |
| `backend/src/ai/ai.service.ts`                            | Replace 5 direct `fetch` calls with gateway calls                                          | 1     |
| `backend/src/uploads/ai-upload.service.ts`                | Replace 2 direct `fetch` calls; stop sending raw rows/PDF text                             | 1     |
| `backend/src/ai/ai-data.service.ts`                       | Split context into `identifying` and `aggregated` projections                              | 1     |
| `backend/src/logging/`                                    | **New** — structured redacting logger                                                      | 1     |
| `backend/prisma/schema.prisma`                            | `Company.dataRegion`; `CashOsLead` consent fields; `AuditLog` model                        | 2     |
| `backend/src/data-plane/`                                 | **New** — `DataPlaneRouter`, `TenantRegionResolver`, `DatabaseProvider`, `StorageProvider` | 2     |
| `backend/src/prisma/prisma.service.ts`                    | Region-aware client resolution behind `DatabaseProvider`                                   | 2     |
| `packages/shared/src/uploads/templates.ts`                | **New** RU safe template with `counterparty_code`                                          | 2     |
| `frontend/src/components/cash-os/lead-form.tsx`           | Consent checkbox; store consent                                                            | 0/2   |
| `backend/test/ruDataResidencyBoundary.test.ts`            | **New** — boundary test that fails the build on prohibited routing                         | 1     |
| `render.yaml`                                             | Explicit `region:`; RU service/database definitions                                        | 0/3   |

## 7. Database changes required (deliverable 11)

```prisma
enum DataRegion {
  GLOBAL
  RU
}

model Company {
  // ...existing fields
  dataRegion   DataRegion @default(GLOBAL)   // immutable once set; changing it is a migration, not an update
  dataRegionSetAt DateTime?
  @@index([dataRegion])
}

model CashOsLead {
  // ...existing fields
  consentGivenAt       DateTime?
  consentPolicyVersion String?
  dataRegion           DataRegion @default(GLOBAL)
}

model AuditLog {                    // new — supports Y11
  id            String   @id @default(cuid())
  tenantId      String
  actorId       String?
  operationType String
  resourceType  String
  rowCount      Int?
  requestId     String?
  errorCode     String?
  createdAt     DateTime @default(now())
  @@index([tenantId, createdAt])
}
```

Also required: a retention policy for `UploadBatch.rowSnapshot` (R5) and `AiInsight.context` (R4) — either a TTL column plus a cleanup path, or restricting what is written in the first place. **Restricting what is written is preferable** and is already part of Phase 1.

All additions are additive with defaults, so existing rows migrate without backfill. `dataRegion` defaulting to `GLOBAL` guarantees no existing tenant's region silently changes (brief §9).

## 8. Environment variables required (deliverable 12)

| Variable                                      | Values                                                     | Default         | Phase |
| --------------------------------------------- | ---------------------------------------------------------- | --------------- | ----- |
| `DATA_REGION`                                 | `GLOBAL` \| `RU`                                           | `GLOBAL`        | 2     |
| `RU_AI_MODE`                                  | `DISABLED` \| `AGGREGATED_EXTERNAL` \| `LOCAL`             | **`DISABLED`**  | 1     |
| `GLOBAL_AI_PROVIDER`                          | `GLOBAL_OPENAI` \| `AI_DISABLED`                           | `GLOBAL_OPENAI` | 1     |
| `RU_CONTROLLED_PILOT_MODE`                    | `true` \| `false`                                          | `true`          | 2     |
| `AI_GATEWAY_STRICT`                           | `true` \| `false` — fail closed on any allowlist violation | `true`          | 1     |
| `LOG_REDACTION_MODE`                          | `strict` \| `permissive`                                   | `strict`        | 1     |
| `RU_DATABASE_URL`                             | connection string                                          | unset           | 3     |
| `RU_STORAGE_ENDPOINT` / `_BUCKET` / `_REGION` | —                                                          | unset           | 3     |
| `RU_LOG_ENDPOINT`                             | —                                                          | unset           | 3     |
| `RU_AI_ENDPOINT`                              | —                                                          | unset           | 3     |
| `PRIVACY_POLICY_VERSION`                      | e.g. `2026-08-09`                                          | —               | 0     |

**Defaults are deliberately safe:** with nothing configured, RU AI is `DISABLED`, pilot mode is on, the gateway fails closed, and logging is strict.

## 9. Migration risks (deliverable 13)

| Risk                                                                   | Severity     | Mitigation                                                                                                             |
| ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Refactoring 7 AI call sites changes global AI output                   | Medium       | `GLOBAL_OPENAI` path must be byte-identical to today's payload; snapshot-test before/after                             |
| Aggregation layer produces wrong totals, and AI narrates wrong numbers | High         | Totals derive from the existing deterministic engine, never recomputed in the gateway; unit-test against engine output |
| `dataRegion` migration locks the `Company` table                       | Low          | Additive column with a default — no rewrite on Postgres 11+                                                            |
| A tenant's region is set incorrectly and cannot be changed             | High         | Immutability is the point; make setting it an explicit, audited operation, not part of normal signup                   |
| Dual-database Prisma clients leak connections                          | Medium       | Single `DatabaseProvider` owning client lifecycle; connection-count assertions in tests                                |
| RU plane deployed but backups still land outside RU                    | **Critical** | Verify backup region _before_ onboarding any RU tenant — this is exactly the trap the brief's §15 warns about          |
| Splitting the single process into two deployables                      | High         | Phase 3 only; the current single-artifact topology is the largest structural obstacle                                  |

## 10. Regression risks for global Liqvia (deliverable 14)

| Risk                                                          | Severity         | Mitigation                                                                                                                                        |
| ------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global AI quality drops if aggregation is applied to everyone | **High**         | Aggregation applies **only** when `dataRegion === RU`. Global tenants keep the full context. Explicit test asserting global payload is unchanged. |
| Gateway adds latency to global AI                             | Low              | In-process filtering; no extra network hop                                                                                                        |
| Gateway becomes a single point of failure                     | Medium           | Every AI feature already has a deterministic rule-based fallback — gateway failure degrades to that, exactly as an OpenAI outage does today       |
| Logging refactor loses operational diagnostics                | Medium           | Keep `error_code` + `request_id`; strictly more useful than today's free-text strings                                                             |
| Region routing adds a query to every request                  | Low              | Region resolved from the JWT claim, not a DB lookup                                                                                               |
| Upload pipeline changes break existing imports                | Medium           | The deterministic normalizer is unchanged; only the AI-assist branch changes. Existing upload tests must stay green.                              |
| Marketing copy change reduces perceived security              | Low, and correct | Publishing an unverified claim is the larger risk                                                                                                 |

## 11. Infrastructure complexity (deliverable 15)

| Phase                                                                                                 | Scope                                               | Complexity |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------- |
| **Phase 0** — verification, marketing correction, log redaction, privacy policy, dev policy           | No architecture change                              | **LOW**    |
| **Phase 1** — AI Privacy Gateway, provider abstraction, aggregation, redacting logger, boundary tests | Application code only, no new infrastructure        | **MEDIUM** |
| **Phase 2** — `data_region`, `DataPlaneRouter`, audit logging, pilot mode, RU safe template           | Application + schema, still single infrastructure   | **MEDIUM** |
| **Phase 3** — RU database, RU storage, RU compute, RU logs, RU backups, DR                            | New regional infrastructure and a second deployable | **HIGH**   |

**Overall programme: HIGH**, but the risk is heavily front-loaded into work that is _not_ high complexity. Phases 0 and 1 remove every RED AI finding and both false-claim findings at LOW/MEDIUM complexity, with no infrastructure spend and no commitment to the Russia decision.

---

## 12. Test plan (brief §25 and §26)

To be built in Phase 1 and extended in Phase 2.

### `ruDataResidencyBoundary.test.ts` — the build-failing boundary test

Deliberately attempts to leak RU data through each channel and asserts each attempt is blocked:

| Channel            | Assertion                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Database           | RU tenant query never resolves to the global client; global query never resolves to the RU client  |
| Storage            | RU storage adapter cannot route to global storage                                                  |
| Logging            | Structured logger drops names, emails, phones, account numbers, request bodies                     |
| AI                 | Gateway rejects names, emails, phone numbers, raw transaction descriptions, raw uploaded documents |
| AI                 | Gateway **allows** aggregated cash metrics from the allowlist                                      |
| Analytics          | No RU tenant data reaches any analytics call                                                       |
| Background workers | N/A today (none exist) — test asserts none are introduced without gateway routing                  |
| Failure mode       | RU infrastructure failure raises, and **never** falls back to GLOBAL                               |

### Isolation tests

- RU tenants cannot read GLOBAL tenant records.
- GLOBAL tenants cannot read RU tenant records.
- `data_region` cannot be mutated through the normal update path.

### Regression guard

- Global tenant AI payload is byte-identical before and after the gateway refactor.
- Existing upload, forecast, scenario and KPI test suites remain green.

---

## 13. Explicit non-goals (brief §28)

This plan does **not**, and must not:

- fork Liqvia into a separate Russian product;
- duplicate the frontend or the business logic;
- remove or degrade the existing global infrastructure;
- rewrite the forecasting engine — it is already deterministic and correct;
- send raw RU uploads or raw RU data to AI or to logs;
- silently fall back to global infrastructure;
- claim Russian compliance because a Russian language option exists;
- claim data residency anywhere it has not been technically verified.
