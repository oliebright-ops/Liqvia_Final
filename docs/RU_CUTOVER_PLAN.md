# RU cutover plan (Phases W, Y)

**Date:** 2026-08-10 · **Status: PREPARED, NOT EXECUTED.**

Every step that provisions a paid resource, deploys to production or changes DNS is a
**STOP CONDITION** requiring explicit owner approval. Nothing below has been run.

---

## 0. Cutover mechanism

Phase Y says: *do not change DNS blindly if routing can be achieved more safely at application or
domain level.* An earlier draft of this document concluded that a Cloudflare origin switch was that
safer route. **That was wrong, and the error is worth stating rather than quietly deleting.**

### The facts, verified 2026-08-09

```
liqvia.info NS  : ns1016.ui-dns.org, ns1020.ui-dns.com,
                  ns1025.ui-dns.de, ns1118.ui-dns.biz     → IONOS.  NOT Cloudflare.
liqvia.info A   : 216.24.57.1
liqvia-landing.onrender.com → gcp-us-west1-1.origin.onrender.com.cdn.cloudflare.net
```

The `server: cloudflare` and `cf-ray` headers on `liqvia.info` come from **Render's own CDN**. That
Cloudflare account belongs to Render, not to the operator. There is no zone to log into and no
origin setting to change. The "reversible in seconds" property the earlier recommendation was built
on **does not exist**.

### Options, corrected

| Mechanism | How | Reversal | Verdict |
|---|---|---|---|
| **A. DNS repoint at IONOS** | `liqvia.info` → A `158.160.44.137` | **TTL-bound**, not instant | ✅ **The only real option** |
| B. Cloudflare origin switch | — | — | ❌ **Not available.** No operator-controlled Cloudflare zone exists |
| C. Application-level proxy | Render app forwards `POST /api/cash-os-leads` to RU | Instant | ❌ **Reject.** Sends every Russian lead through a US host in transit — defeats the objective while looking like success |

### What follows from A being the only option

1. **Rollback is TTL-bound.** Lower the record TTL to **300s at least 24 hours** before the change.
   During the window, leads land wherever each resolver happened to point — and afterwards you
   cannot tell which. Keeping the window short is the mitigation; there is no way to remove it.
2. **TLS must be settled first.** Caddy currently serves `tls internal` (self-signed), which was
   fine while no public hostname pointed here. Once DNS moves there is no CDN terminating TLS on a
   valid certificate, so visitors would see a warning. Caddy can issue a real Let's Encrypt
   certificate automatically, but needs inbound **TCP 80** for the HTTP-01 challenge — so open 80 on
   `liqvia-ru-app-sg` as part of the cutover, or use DNS-01 and keep 80 closed.
   **Do not move DNS before this is done.** This sequencing constraint did not exist under the
   mistaken assumption.
3. **Render's CDN is lost.** Caching, TLS termination and DDoS absorption all disappear when DNS
   points straight at a single 2-vCPU instance. Acceptable for a small lead funnel, but a decision
   rather than a surprise — and a further argument for the 100%-guaranteed CPU tier already chosen.

**The authenticated global Liqvia domain is not touched by any of this.**

---

## 1. Pre-cutover — code and configuration

Repository work. No infrastructure, no cost, no deployment.

- [x] Consent/privacy checkpoint committed — **`fc026f8`**, branch `ru/consent-privacy-checkpoint`
- [x] ИНН removed from all public surfaces; public/private operator split; guard added
- [x] Fail-closed residency guard implemented (boot + request time)
- [x] Boundary tests: no AI, no personal data in logs, no fallback, no identity in `source`
- [x] Metrica verified against production with synthetic data — **no P0**
- [ ] Add `webvisor: false` explicitly to the Metrica `init` call *(one line; see `RU_METRICA_VERIFICATION.md` §5.1)*
- [ ] Apply Metrica input-masking attributes to the lead form *(cheap now, decisive if Webvisor is ever enabled)*
- [ ] Global exception filter — log class + request ID, never the message *(`RU_PRODUCTION_DATA_FLOW.md` §7)*
- [ ] Add `qa/` to `.gitignore` *(real client data, currently untracked and not ignored)*
- [ ] Repoint local `.env` away from production; rotate Render credentials
- [x] Lead retention decided (1 month) and implemented; `ConsentRecord` retention still **REVIEW REQUIRED**
- [x] Create the RU-only Prisma schema + migrations directory — **applied to the RU database**

## 2. Pre-cutover — re-verify the facts

The audit is dated. **Re-run immediately before cutover**, because the conclusions depend on facts
that change the moment traffic arrives.

- [ ] Re-run the historical-lead query. **If `historical_ru_leads > 0`, stop** — `RU_HISTORICAL_LEAD_MIGRATION.md` no longer applies and a migration proposal is needed
- [ ] Confirm `origin/landing-production` is still the deployed branch
- [ ] Confirm the Metrica console: Webvisor off, form analytics off, access list reviewed
- [ ] Confirm no Yandex Direct campaign is live

## 3. Phase W — build and verify with synthetic data

**No real traffic reaches the RU plane until all 16 checks pass.**

| # | Check | Pass criterion |
|---|---|---|
| 1 | Yandex infrastructure created | VPC, private subnet, security groups per `RU_YANDEX_CLOUD_ARCHITECTURE.md` §4 |
| 2 | RU application deployed | `LIQVIA_DATA_PLANE=ru`; health check green |
| 3 | RU lead schema applied | `information_schema` returns **exactly** `CashOsLead`, `ConsentRecord`, `_prisma_migrations` |
| 4 | Security configured | DB has no public IP; no CIDR allow-rules; `liqvia_app` has no `DELETE` |
| 5 | Secrets configured | All credentials from Lockbox; none in Git, image or user-data |
| 6 | Logging configured | Cloud Logging receiving; Audit Trails enabled |
| 7 | Backups configured | Enabled, **same RU region**, retention recorded, **restore tested** |
| 8 | Synthetic RU lead submitted | `TEST USER` / `test@example.invalid` / `+7 000 000 00 00` / `TEST COMPANY` |
| 9 | `CashOsLead` row verified | Row present in **RU** database with the expected fields |
| 10 | `ConsentRecord` verified | Row present, linked, in the same transaction |
| 11 | Wording version verified | `version` matches what the page displayed; `textVerified = true` |
| 12 | Logs contain no identity | No name, email, phone or comment at any log level |
| 13 | Email behaviour verified | **No email sent** (no lead mail path exists) |
| 14 | Metrica/Webvisor verified | Goal fired with no parameters; no recorder traffic |
| 15 | No OpenAI call | Zero outbound provider requests during submission |
| 16 | **Global Postgres has no new RU record** | `SELECT count(*) FROM "CashOsLead"` in `liqviadb` **unchanged** |

Check 16 is the one that proves the migration worked. Checks 1–15 can all pass while leads still
land in Oregon.

### Fail-closed verification (do this deliberately)

- [ ] Stop / block the RU database. Submit a synthetic lead. Confirm: `503`, retry message shown,
      **no row in the global database**, logs contain the error class only.
- [ ] Deploy with `LIQVIA_DATA_PLANE=ru` and a *global* `DATABASE_URL` in a **staging** environment.
      Confirm the process **refuses to start**.

## 4. Phase Y — cutover sequence

Each numbered step is a decision point. Stop at any failure.

1. [ ] Confirm checkpoint commit `fc026f8` and the migration branch are reviewed
2. [ ] Confirm Yandex infrastructure healthy (§3 checks 1–7)
3. [ ] Confirm RU DB backups exist **and a restore has been tested**
4. [ ] Confirm all 16 synthetic tests pass
5. [ ] Confirm Metrica/Webvisor state
6. [ ] Confirm SMTP behaviour (no lead email; notification model decided — `RU_SMTP_DATA_FLOW.md` §4)
7. [ ] Confirm `/privacy` and `/consent` resolve on the RU deployment, `noindex`, draft banner intact
8. [ ] **Confirm legal blockers separately** — see §6. This is not an engineering sign-off
9. [ ] **Switch RU lead submissions** — Cloudflare origin → RU application *(STOP CONDITION)*
10. [ ] Submit **one synthetic lead** post-cutover, immediately
11. [ ] Verify it landed in the **RU** database with its consent record
12. [ ] Verify the **global** database count is unchanged
13. [ ] Monitor logs and error rates for 24h before any paid traffic

**Only after step 13 may Yandex Direct spend begin.**

## 5. Rollback

| Trigger | Action |
|---|---|
| Leads not arriving in the RU database | Revert the Cloudflare origin. Seconds |
| Personal data observed in logs | Revert; fix; re-verify check 12 |
| RU database unreachable | **No action needed** — the guard fails closed. Investigate; visitors see a retry message |
| A lead appears in the **global** database | **Serious.** Revert immediately; treat as a residency incident; determine how the guard was bypassed |

Rollback returns lead capture to the global plane, which is where it is today. Any lead captured
globally during a rollback window is a Russian lead in Oregon and must be recorded as such.

## 6. Legal blockers — separate from all of the above

These are **not** cleared by any step in this plan, and none can be closed by shipping code:

| Blocker | Status |
|---|---|
| Verified operator contact email | ❌ `null` |
| Verified postal address for statutory requests | ❌ `null` |
| Legal approval of `/privacy` wording | ❌ `LEGAL_REVIEW_PENDING` |
| Legal approval of `/consent` wording | ❌ `LEGAL_REVIEW_PENDING` |
| Whether the ИНН must be published | ❌ Open — currently not published |
| Retention periods | ❌ Undefined |
| Operator notification obligations | ❌ Not assessed |
| Contracting entity, billing, banking, sanctions | ❌ Not assessed |
| Foreign administrative access to RU personal data | ❌ Not assessed |

> **A technically perfect cutover does not make Liqvia compliant with 152-FZ**, and the two must not
> be conflated in any public statement. Infrastructure readiness and legal readiness are separate
> gates, and this plan only clears the first.

## 7. Stop conditions

Owner approval required before: production deployment · DNS cutover · any paid Yandex Cloud resource
change · historical production-data migration · source-data deletion · global database modification ·
repository-history rewriting · publishing legal documents · removing `LEGAL_REVIEW_PENDING` ·
enabling marketing consent · enabling unrestricted RU financial uploads · building the full RU
application · any public statement of 152-FZ compliance or data residency · any sanctions or legal
conclusion.
