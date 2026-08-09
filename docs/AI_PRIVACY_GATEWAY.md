# AI Privacy Gateway — Architecture and Data Contract

**Status:** implemented (Phases 0–2). No jurisdiction-specific infrastructure has been built.
**Applies to:** every external AI call the product makes.

---

## 1. Architecture principle

Liqvia's deterministic financial engine is the source of truth. The model explains; it does not
compute. Nothing in this change alters the forecast engine, and nothing should.

```
raw client data
  → deterministic parser / normaliser        (packages/shared/src/uploads, backend/src/uploads)
  → Liqvia financial engine                  (backend/src/treasury, scenarios, free-cash, …)
  → calculated / aggregated metrics          (backend/src/ai/ai-data.service.ts → TreasuryAiContext)
  → deterministic projection + pseudonymisation
                                             (backend/src/ai-gateway/decision-context.ts)
  → AI Privacy Gateway (allowlist validation)
                                             (backend/src/ai-gateway/ai-privacy-gateway.service.ts)
  → provider adapter                         (backend/src/ai-gateway/providers/openai.provider.ts)
  → external AI
  → explanation / recommendation
```

`TreasuryAiContext` remains Liqvia's rich internal object. It powers the rule-based fallbacks and
is returned to the authenticated user's own browser. **It is never serialised to a provider.**
Only the projected, validated `AiPayload` crosses the boundary.

## 2. OpenAI call sites — before and after

### Before (7 direct `fetch` calls, 2 files, no abstraction)

| #   | File:line                                      | Purpose                 | What it sent                                                                                       |
| --- | ---------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `backend/src/ai/ai.service.ts:278`             | Business Pulse briefing | `JSON.stringify(entire TreasuryAiContext)`                                                          |
| 2   | `backend/src/ai/ai.service.ts:409`             | Decision Centre         | Entire context + question verbatim + scenario                                                       |
| 3   | `backend/src/ai/ai.service.ts:526`             | Why has this changed?   | Movement objects                                                                                    |
| 4   | `backend/src/ai/ai.service.ts:586`             | AI CFO chat             | Entire context + full chat history verbatim                                                         |
| 5   | `backend/src/ai/ai.service.ts:657`             | AI CFO insight          | Entire context + question verbatim                                                                  |
| 6   | `backend/src/uploads/ai-upload.service.ts:376` | PDF → CSV extraction    | **Up to 12,000 characters of raw bank-statement text**                                              |
| 7   | `backend/src/uploads/ai-upload.service.ts:438` | Upload column mapping   | **8 complete raw data rows, all values**                                                            |

Sites 1, 2, 4 and 5 each transmitted customer names, supplier names, bank-account names, obligation
names and up to 80 raw bank narratives per request.

### After (1 call site, 1 file)

| #   | File                                                 | Purpose                          | What it sends                        |
| --- | ---------------------------------------------------- | -------------------------------- | ------------------------------------ |
| 1   | `backend/src/ai-gateway/providers/openai.provider.ts` | The only provider adapter        | A validated `AiPayload` and nothing else |

Sites 6 and 7 are **deleted**, not rerouted. There is no AI path for raw uploaded content at all.

| Old site | Disposition                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------- |
| 1–5      | Routed through `AiPrivacyGatewayService.run()`                                                   |
| 6        | Removed — low-confidence PDFs now return a `BadRequestException` asking for CSV/Excel            |
| 7        | Removed — low-confidence mappings now surface for manual column mapping or a template request    |

## 3. Fields permitted through the gateway

Defined and enforced in `backend/src/ai-gateway/payload-schema.ts`. Every schema is `.strict()`.

| Block                | Permitted fields                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`               | `asOfDate`, `currency`, `locale`, `businessMode`, `sector`                                                                            |
| `liquidity`          | `openingCash`, `week13ClosingCash`, `runwayWeeks`, `weeklyBurn`, `liquidityStatus`, `minimumCashBuffer`, `freeAvailableCash`, `fixedOutflowsHorizon`, `horizonWeeks` |
| `weeks[]`            | `weekIndex`, `openingCash`, `inflows`, `outflows`, `closingCash`                                                                      |
| `receivables`        | `total`, `overdueTotal`, `dueNext30Days`, `delayedOver90Days`, `count`, `topConcentrationPct`                                          |
| `receivables.items[]`| `counterpartyCode`, `amount`, `dueWeek`, `daysOverdue`, `status`, `shareOfTotalPct`, `collectionConfidence`, `cashImpact`              |
| `payables`           | `total`, `overdueTotal`, `count`, `topConcentrationPct`                                                                               |
| `payables.items[]`   | `counterpartyCode`, `amount`, `dueWeek`, `daysOverdue`, `status`, `shareOfTotalPct`, `priority`, `cashImpact`                          |
| `obligations[]`      | `obligationCode`, `category` (closed enum), `amount`, `frequency`, `dueWeek`, `isRecurring`, `confidence`                              |
| `cashFlowCategories[]`| `category` (closed enum), `direction`, `total`, `count`, `averageAmount`, `cadenceDays`, `isRecurring`                                |
| `budget[]`           | `period`, `category` (sanitised label), `budgetAmount`, `actualAmount`, `varianceAmount`, `variancePercent`                            |
| `alerts[]`           | `type`, `severity` — **not `message`**                                                                                                |
| `dataCoverage`       | row counts per module                                                                                                                  |
| `payroll`            | `nextPayrollWeek`, `expectedAmount`, `availableCash`, `bufferAfterPayroll`, `status`                                                   |
| `cashByPurpose`      | `totalCash`, `payrollReserve`, `taxReserve`, `emergencyReserve`, `restrictedOrClearingFunds`, `knownUpcomingObligations`, `availableToSpend` |
| `scenario`           | baseline/scenario/delta for week-13 cash and runway, `assumptions[]`                                                                    |
| `movements[]`        | `label` (Liqvia KPI vocabulary), `current`, `previous`, `delta`, `percentChange`, periods                                              |
| `question`           | `category` (closed enum), `redactedText`, `horizonMonths`                                                                              |
| `dataQuality`        | `score`, `warningCount`                                                                                                                |

## 4. Fields explicitly prohibited

Prohibited three ways: absent from the allowlist, matched by `PROHIBITED_KEY_PATTERNS`, and
covered by negative tests.

- Customer, supplier, employee, counterparty and company **names**
- **Company and user identifiers** (`companyId`, `userId`)
- **Bank account names and numbers**, IBANs, card numbers
- **Email addresses, phone numbers, postal addresses**
- **Raw bank transaction narratives / descriptions**
- **Raw uploaded rows**, CSV content, spreadsheet content
- **Raw PDF / document text**
- **Verbatim user questions** (only the redacted form travels)
- Alert `message` strings, obligation names, settlement `destinationAccount`
- Tax identifiers (INN/OGRN and equivalents)

## 5. Preserving decision quality

Removing identity is not the same as removing information. The projection replaces identity with
stable pseudonymous codes (`CUSTOMER_C014`) and adds derived structure so the model retains every
capability it had:

| Capability                      | Signal that carries it                                    |
| ------------------------------- | --------------------------------------------------------- |
| Customer A vs Customer B        | distinct stable `counterpartyCode`                         |
| Critical vs non-critical items  | `cashImpact` bucket + `shareOfTotalPct`                    |
| Large vs small                  | `amount` retained exactly                                  |
| Overdue vs current              | `status`, `daysOverdue`, `collectionConfidence`            |
| Concentration risk              | `topConcentrationPct` + per-item share                     |
| Payment timing                  | `dueWeek` relative to `asOfDate`                           |
| Recurring vs one-off            | `isRecurring`, `frequency`, `cadenceDays`                  |
| What kind of money moved        | `cashFlowCategories` from local narrative classification   |
| Scenario reasoning              | `scenario` deltas                                          |
| Forecast confidence             | per-obligation `confidence`, `dataQuality`, `dataCoverage` |

`PAYLOAD_CONTRACT_PROMPT` in the gateway teaches the model how to read codes and buckets, so the
pseudonyms cost nothing in comprehension.

Regression coverage: `backend/src/ai-gateway/decision-quality.spec.ts`.

## 6. Bank narratives

Raw narratives are blocked by default and have no override. `categorizeTransaction()` already runs
inside Liqvia; only its verdict, plus per-category totals, counts, averages and an inferred
cadence, reach the model.

## 7. Low-confidence imports

There is no raw-data LLM fallback. When deterministic parsing cannot confidently map a file:

1. the response asks the user to map columns (headers are known; rows never leave);
2. or points at the supported Liqvia template for that upload type;
3. or returns a safe parsing error naming the expected columns.

`resolveLowConfidence()` in `ai-upload.service.ts` implements this order. The structure leaves room
for saved per-source import mappings later — mapping resolution is already a separate, deterministic
step keyed by template type.

## 8. Free-text questions

Treated as untrusted and potentially personal. `redactFreeText()` runs two passes:

1. known counterparty names → their pseudonymous codes (keeps the question answerable);
2. emails, phones, IBANs, card numbers, RU 20-digit accounts, tax ids, URLs → typed placeholders.

Input is capped at 1,000 characters. Chat history receives identical treatment.

## 9. `AiInsight` persistence — before and after

**Before:** `AiInsight.context` stored the entire `TreasuryAiContext` on every interaction —
counterparty names, raw narratives, and the user's verbatim question — creating a second permanent
copy of the customer's financial data. Nothing ever read it back.

**After** (`schemaVersion: 2`):

| Field              | Content                                                     |
| ------------------ | ----------------------------------------------------------- |
| `schemaVersion`    | `2`                                                         |
| `feature`          | which AI feature produced this                              |
| `asOfDate`         | snapshot date                                               |
| `currency`         | reporting currency                                          |
| `payloadDigest`    | SHA-256 (16 hex) of the exact payload sent — a reference, not a copy |
| `metrics`          | opening cash, week-13 closing cash, runway, liquidity status |
| `questionCategory` | classification only — **never the question text**            |
| `redactionCounts`  | counts by type; contains no values                          |
| `scenarioIncluded` | boolean                                                     |
| `model`, `source`, `latencyMs` | provenance                                      |

`AiInsight.content` (the generated answer) is unchanged — it is the product feature.

## 10. Enforcement

| Mechanism                                                        | What it catches                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `eslint.config.mjs` — `no-restricted-imports` / `no-restricted-syntax` | Provider SDK imports or endpoint literals outside `ai-gateway/providers/**` |
| `ai-boundary.spec.ts`                                            | Same, by repository scan — cannot be silenced with a lint comment |
| `aiPayloadSchema.strict()`                                       | Any field not on the allowlist                                 |
| `findProhibitedKeys()`                                           | Prohibited key names at any depth (independent second check)   |
| `AiGatewayModule` exports                                        | `OpenAiProvider` is not exported; only the gateway is          |

A rejected payload never reaches the provider. The calling feature falls back to its deterministic
rule-based answer, and the rejection is logged as a Liqvia defect (field paths only, never values).

## 11. Tests added

| File                                              | Covers                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `backend/src/ai-gateway/ai-boundary.spec.ts`      | Build-failing provider boundary                                            |
| `backend/src/ai-gateway/ai-privacy-gateway.spec.ts` | Negative (8 PII classes stripped, 7 prohibited payload shapes rejected) and positive (approved metrics reach the provider) |
| `backend/src/ai-gateway/redaction.spec.ts`        | Free-text redaction and pseudonymisation properties                        |
| `backend/src/ai-gateway/decision-quality.spec.ts` | Decision-quality regression — the capabilities in §5                        |
| `backend/src/ai-gateway/test-fixtures.ts`         | Shared context fixture populated with identifying data                      |

## 12. Out of scope — deliberately not built

`DATA_REGION`, RU tenant routing, a separate RU API, Russian database or storage, Russian server
deployment, cross-region migration and local Russian AI are **not implemented**. They remain a
later decision gate. See `docs/RUSSIA_DATA_RISK_REGISTER.md`.
