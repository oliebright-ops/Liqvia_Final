# RU migration test report & GO / NO-GO dashboard

**Date:** 2026-08-10
**Checkpoint:** `fc026f8` (`ru/consent-privacy-checkpoint`)
**Migration branch:** `ru/yandex-data-plane`
**Infrastructure state:** **no Yandex Cloud resource has been created.**

---

## 1. Test results

### Backend — RU-relevant suites

```
PASS  src/residency/data-plane.spec.ts
PASS  src/cash-os-leads/ru-lead-boundary.spec.ts
PASS  src/cash-os-leads/cash-os-leads.service.spec.ts
PASS  src/consent/consent-registry.spec.ts
PASS  src/ai-gateway/ai-boundary.spec.ts
PASS  src/ai-gateway/ai-privacy-gateway.spec.ts
PASS  src/ai-gateway/redaction.spec.ts
PASS  src/ai-gateway/decision-quality.spec.ts

Test Suites: 8 passed, 8 total
Tests:     131 passed, 131 total
```

### Frontend

```
tests 34 · pass 34 · fail 0
```

### Full backend suite — pre-existing failures, disclosed

```
Test Suites: 3 failed, 29 passed, 32 total
Tests:       4 failed, 304 passed, 308 total
```

The 4 failures are in `src/uploads/upload-import.service.spec.ts`,
`src/uploads/upload-validation.integration.spec.ts` and `src/budget/budget.service.spec.ts` —
database-integration suites that time out without a live database.

**Verified pre-existing:** the same 4 tests fail identically on the unmodified tree (stashed, re-run,
same result). They are **not** caused by this work and are unrelated to the RU lead plane.

---

## 2. Required tests — coverage matrix

| Required test | Status | Where |
|---|---|---|
| RU lead → RU PostgreSQL | ⏳ **Cannot run** — no RU database exists. Covered by Phase W check 9 | `RU_CUTOVER_PLAN.md` §3 |
| RU consent → RU PostgreSQL | ⏳ **Cannot run** — as above. Phase W check 10 | `RU_CUTOVER_PLAN.md` §3 |
| RU lead → NOT global PostgreSQL | ✅ Guard proven; ⏳ end-to-end at Phase W check 16 | `data-plane.spec.ts` |
| RU lead → NOT OpenAI | ✅ **Proven** | `ru-lead-boundary.spec.ts` |
| RU personal data → NOT logs | ✅ **Proven** — and it found a real defect | `ru-lead-boundary.spec.ts` |
| RU identity → NOT Metrica custom events | ✅ **Proven** — compile-time + live runtime | `analytics.ts` types · `RU_METRICA_VERIFICATION.md` §3 |
| RU identity → NOT UTM/URL | ✅ **Proven** | `ru-lead-boundary.spec.ts` |
| RU DB unavailable → NO global fallback | ✅ **Proven** | `ru-lead-boundary.spec.ts` |
| Consent wording displayed = recorded version | ✅ **Proven** | `consent-registry.spec.ts`, `legal-publication.test.ts` |
| Legal links work | ✅ **Proven** (routing + segmentation) | `middleware.test.ts`, `legal-publication.test.ts` |
| Global Liqvia unaffected | ✅ 29/29 non-DB suites pass; guard is a no-op on `global` | `data-plane.spec.ts` |
| Global financial engine unaffected | ✅ Untouched — no file in the forecast/scenario/budget path modified | `git diff --stat` |
| `AiPrivacyGateway` intact | ✅ **Proven, not weakened** | `ai-boundary.spec.ts` |

**Six of the thirteen prove a negative.** Those are the ones worth automating: nothing fails visibly
when a negative stops holding.

---

## 3. Defects found by writing the tests

### 3.1 Personal names and free text reached the log sink — **FIXED**

`describeErrorForLog` redacts what it can *recognise* — emails, phones, IBANs, digit runs. It cannot
recognise a name or free text, because those have no pattern.

A Prisma write failure embeds the row it failed to write. Passed through the existing helper, the
email and phone were masked while **«Иван Петров» and the free-text comment went through verbatim.**

**Fix:** `describeErrorClassForLog` — error class and driver code only, message discarded. Applied on
the lead path, where the message is not sanitisable at any level of cleverness.

Found by the test failing, not by reading the code.

### 3.2 The archived "V1" consent wording was a paraphrase — **FIXED**

The registry's `2026-08-09.1` entry did not match the sentence actually deployed on `liqvia.info`
(«я подтверждаю…» vs the live «вы соглашаетесь…»). An archive exists to record what a person really
saw; a paraphrase is not evidence. Corrected to the verbatim served text.

### 3.3 The ИНН was in the consent wording and would have entered Git — **FIXED**

Verified by `git log --all -S`: **the ИНН had never been committed.** Every file containing it was
untracked at the time of removal. Removed before the checkpoint, so **no history rewriting is
required or proposed.**

---

## 4. Findings requiring owner action (not fixed here)

| # | Finding | Severity | Why not fixed here |
|---|---|---|---|
| 1 | Production DB credentials in local `.env`; full read/write to production from a laptop | **HIGH** | Rotating production credentials is a STOP CONDITION |
| 2 | `qa/ok-bankrot/` — real client data incl. `CONFIDENTIAL_name_mapping.csv`, untracked and **not gitignored** | **HIGH** | Excluded from the checkpoint; `.gitignore` change is the owner's call |
| 3 | Live form has **no consent checkbox**; uses submission-implied agreement | **HIGH** | Fixed in `fc026f8`, **not deployed** — deployment is a STOP CONDITION |
| 4 | Live consent references a privacy policy that returns `307 → /` | **HIGH** | As above |
| 5 | Webvisor can be enabled from the Metrica console with no code change | **MEDIUM** | Mitigations proposed; console access is the owner's |
| 6 | No global exception filter — an unhandled error may carry a request body to logs | **MEDIUM** | Changes global application behaviour; out of scope |
| 7 | Retention periods undefined for both RU tables | **MEDIUM** | Business/legal decision |
| 8 | `render.yaml` does not describe production | **LOW** | Documentation; no RU impact once the RU plane is separate |

---

## 5. GO / NO-GO dashboard

| Area | Verdict | Basis |
|---|---|---|
| **Yandex infrastructure** | **NO-GO** | Nothing created. Provisioning is a STOP CONDITION requiring approval and spend |
| **RU lead database** | **NO-GO** | Does not exist. Specified in `RU_DATABASE_CONFIGURATION.md`, unbuilt |
| **Metrica / Webvisor** | **GO** | Verified live with synthetic name, email and phone: no recorder, no field capture, no parameters, no UserID. No P0 |
| **RU privacy/consent technical mechanism** | **GO** | Versioned, unticked, blocking, server-enforced, transactional, hash-verified. 131 backend + 34 frontend tests pass. **Built and unshipped** |
| **RU privacy/consent legal wording** | **LEGAL REVIEW REQUIRED** | Contact email and postal address are `null`; both pages `LEGAL_REVIEW_PENDING`; whether the ИНН must be published is open |
| **Russian paid advertising** | **NO-GO** | The live form has no consent checkbox and `/privacy` is unreachable. Paid traffic would send real people into a funnel with defective consent and no reachable policy |
| **Russian lead collection** | **CONDITIONAL GO** | Technically sound and legally blocked. Conditions: deploy `fc026f8`, supply verified contact facts, obtain legal approval, complete cutover |
| **Historical RU lead migration** | **NOT REQUIRED** | `historical_ru_leads = 0`. All 4 rows are test data (1 operator, 3 `example.com`) |
| **Russian aggregated financial pilot** | **CONDITIONAL GO** | Possible without raw financial data, but needs its own review. See `RU_AUTHENTICATED_APP_DESIGN.md` §7 |
| **Russian raw financial uploads** | **NO-GO** | No RU upload infrastructure; `UploadBatch.rowSnapshot` retention unresolved |
| **Full RU authenticated Liqvia** | **DEFERRED** | Design only. A programme of work, not a migration |

---

## 6. The single most consequential finding

> **`historical_ru_leads = 0`.**
>
> Not one member of the public has submitted a lead through `liqvia.info`. Every issue in this
> report — implied consent, an unreachable privacy policy, an unidentified operator, personal data
> in Oregon, no consent evidence — currently affects **nobody**.
>
> This is the difference between prevention and remediation, and it is entirely a function of
> timing. It stops being true with the first Yandex Direct click.

**Recommended order:** fix and deploy the consent framework → resolve the legal facts → build the RU
plane → cut over → *then* buy traffic. Buying traffic first converts every finding here into a live
incident involving real people, simultaneously.

---

## 7. Statements NOT made by this report

- That Liqvia is compliant with 152-FZ. **It does not say this.**
- That hosting on Yandex Cloud would make it compliant. It would not.
- That the consent wording is legally sufficient. **LEGAL REVIEW REQUIRED.**
- Any conclusion about sanctions, corporate structure, banking or operator notification.

**No public statement of 152-FZ compliance or data residency should be made on the basis of this
document.**
