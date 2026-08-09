# RU historical lead migration (Phase C / Phase Z)

**Date:** 2026-08-10 · **Status:** **NOT REQUIRED**

---

## Determination

```
historical_ru_leads = 0
```

**No historical migration is required, and none is proposed.** The Yandex database starts empty and
future Russian leads are routed to it directly.

---

## Evidence

Read-only aggregate queries against the production database (`liqviadb`,
`dpg-…-a.oregon-postgres.render.com`) on 2026-08-10. Shape only — no `name`, `email`, `phone` or
`comment` value was read.

`CashOsLead` contains **4 rows**:

| # | Created (UTC) | Email domain | `name` len | `phone` len | `comment` len | Source | Assessment |
|---|---|---|---|---|---|---|---|
| 1 | 2026-08-08 13:45:07 | `gmail.com` — **equals the operator's own address** | 1 | 0 | 0 | `cash-operating-system-landing` | Operator smoke test |
| 2 | 2026-08-09 06:51:10 | `example.com` | 4 | 4 | 4 | `cash-operating-system-landing` | Synthetic |
| 3 | 2026-08-09 06:51:50 | `example.com` | 4 | 4 | 4 | `cash-operating-system-landing` | Synthetic |
| 4 | 2026-08-09 06:52:12 | `example.com` | 4 | 4 | 4 | `cash-operating-system-landing` | Synthetic |

Grounds for classifying all four as test data:

1. **Row 1** was submitted from the operator's own email address, with a **one-character name** — not
   a submission from a member of the public.
2. **Rows 2–4** use `example.com`, reserved by RFC 2606 precisely so it can never be a real mailbox.
   All three arrived **within 62 seconds of each other** with uniform 4-character values in every
   field — the signature of a form being exercised, not three people enquiring.
3. Every row predates any Russian advertising spend. No campaign has run.

## Consent evidence for these rows

**None exists, and none can.** The `ConsentRecord` table does not exist in production; the
`20260809120000_consent_records` migration has never been applied there. The most recent applied
migration is `20260808022051_cash_os_lead_optional_phone_industry_size`.

The consent these four submissions were shown was the pre-framework notice — «Отправляя форму, вы
соглашаетесь…» — which referenced a privacy policy that returns `307 → /` and identified no operator.
It is now registered as `cash-os-lead-form@2026-08-09.1` so the archive tells the truth about it.

Because all four rows are test data, this is a documentation matter, not a remediation one.

---

## Consequences

1. **Phase Z is not executed.** No export, no validation, no hash comparison, no import, no
   migration audit evidence — there is nothing to move.
2. **No source-deletion proposal is required.** Nothing is being copied, so nothing needs a
   retention-or-delete decision as a *consequence of migration*.
3. **The RU database starts clean**, which is strictly better than a migrated one: no provenance
   questions, no partially-consented records, no rows whose lawful basis has to be reconstructed
   after the fact.

## Recommended handling of the four test rows

**Not a migration action, and not urgent.** Once the RU plane is live and the global lead path is
retired, these four rows have no purpose. Row 1 contains the operator's own personal data; rows 2–4
contain none.

Suggested, requiring owner approval before execution:

```
DELETE FROM "CashOsLead" WHERE id IN (…4 ids…);
```

This is a **global database modification** and therefore a **STOP CONDITION**. It is recorded as a
proposal only. Do not run it as part of the migration; it is unrelated tidy-up that happens to have
been discovered here.

---

## If this determination ever changes

This document is valid **as of 2026-08-10**. It stops being valid the moment a real lead is
submitted through `liqvia.info` — which is what Yandex Direct traffic is for.

**Re-verify immediately before cutover.** If `historical_ru_leads > 0` at that point:

1. Do **not** proceed on the strength of this document.
2. Produce a migration proposal covering export scope, field mapping, consent-evidence mapping,
   transport encryption, row-count and hash validation, and migration audit evidence.
3. Obtain separate owner approval for the migration, and **separate approval again** for source
   deletion. They are two controlled actions, never one.
4. Do not delete source records until the destination has been independently verified.

The re-verification query — aggregate only, no personal-data values:

```sql
SELECT count(*)                                        AS total,
       min("createdAt")                                AS earliest,
       max("createdAt")                                AS latest,
       count(*) FILTER (WHERE split_part(email,'@',2) <> 'example.com') AS non_synthetic
FROM "CashOsLead";
```

This is the check step in `RU_CUTOVER_PLAN.md` §2.
