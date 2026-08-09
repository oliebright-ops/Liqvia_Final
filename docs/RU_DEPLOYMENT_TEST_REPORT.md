# RU application deployment — synthetic test report

**Date:** 2026-08-09 · **Origin:** `158.160.44.137` (`liqvia-ru-app`, `ru-central1-a`)
**Method:** synthetic data only, executed against the running RU deployment.
**Not yet public:** `liqvia.info` still resolves to Render. Nothing has been cut over.

---

## 1. Deployment

| | |
|---|---|
| Image | `liqvia-ru:latest`, built on the instance from the repo Dockerfile |
| Stack | `app` (Next.js + NestJS, one process, port 3000 internal) + `caddy` (origin TLS, 443) |
| Health | `app running (healthy)` — `{"status":"ok","service":"liqvia2-api","aiCfo":"fallback_no_api_key"}` |
| Credentials | Fetched from **Lockbox at boot** by the instance service account. Never in the image, in Git, or in user-data |
| Env | `LIQVIA_DATA_PLANE=ru`, `DATABASE_URL` → RU PostgreSQL with `sslmode=verify-full`. **No `OPENAI_API_KEY`, no `SMTP_HOST`** |

`aiCfo: fallback_no_api_key` is the app itself reporting that no AI provider is configured.

---

## 2. Results

### §13 Consent and privacy — **PASS**

| Check | Result |
|---|---|
| Consent checkbox present | PASS |
| New wording served (`Я даю Оли Брайту Бабатунде…`) | PASS |
| Old implied-consent wording (`Отправляя форму, вы соглашаетесь…`) gone | PASS |
| Legal links present | PASS |
| ИНН absent from landing | PASS |
| ИНН absent from `/privacy` | PASS |
| `/privacy` reachable (200) | PASS |
| `/consent` reachable (200) | PASS |
| Verified contact email on `/privacy` | PASS |
| Postal-address line omitted (not placeholdered) | PASS |
| 1-month retention stated in the policy | PASS |
| `noindex` still applied (draft) | PASS |
| Withdrawal channel on `/consent` | PASS |

### §14 Transactional consent — **PASS**

Synthetic lead `RU-ISOLATION-TEST-1786306443` → **HTTP 201**.

```
CashOsLead rows for mark : 1
ConsentRecord linked     : 1
textVerified             : t
consent version          : 2026-08-10.1
source stored            : ru_isolation_test    (campaign tag, not a URL)
```

`textVerified = t` means the wording posted by the browser matched the server-side registry
character-for-character. That is the property the whole consent design exists to guarantee.

### §27 Global isolation — **PASS**

```
GLOBAL (Oregon) total CashOsLead rows : 4      (unchanged — the 4 pre-existing test rows)
GLOBAL (Oregon) rows for this mark    : 0
GLOBAL (Oregon) any RU-ISOLATION-TEST : 0
```

### §15 Logging — **PASS**

No occurrence of the lead's name, email, phone, comment or company in the application logs.
No credential and no connection string. No AI provider reference.

### §25 OpenAI — **ZERO**

No OpenAI reference in logs; no API key configured; health endpoint reports `fallback_no_api_key`.

### §28 Retention — **PASS**

A lead was aged past the 30-day ceiling and the retention erasure was executed **as the runtime
role**, which holds no `DELETE`:

```
UPDATE-based erasure       : SUCCEEDED as liqvia_app
rows still holding PII     : 0
erased row                 : [удалено] | [удалено] | (null)
source retained            : ru_isolation_test      (non-identifying)
CONSENT RECORDS AFTER      : 1                       ← survived
consent wording intact     : "Я даю Оли Брайту Бабатунде согласие на обр…"
```

Cleanup of the probe rows **required the migrator** — `liqvia_app` could not delete them. The
separation demonstrated again, incidentally rather than by design.

### §26 Fail closed — **PASS on data, GAP on user experience**

**First attempt was an invalid test and is recorded as such.** An `iptables -I OUTPUT` rule blocked
the *host* but not the container (container traffic traverses `FORWARD`/`DOCKER-USER`), so the
database stayed reachable, the lead was written, and the `201` was correct. Reporting that as a
failure would have been wrong; reporting it as a pass would have been worse.

Re-run correctly via `DOCKER-USER`:

| | |
|---|---|
| Container → 6432 | **BLOCKED** (verified from inside the container) |
| Submit while DB unreachable | **HTTP 502** |
| Rows before / after | **2 / 2 — unchanged** |
| Probe rows written | **0** |
| Written to global Oregon DB | **none** |
| Local PII file / queue | none |
| Log | `errorCode: 'P1001'` (cannot reach database) |

**The residency property holds: nothing was written anywhere, and there was no fallback.**

> ### GAP — the visitor sees a bare 502, not the Russian retry message
>
> `LEAD_STORAGE_UNAVAILABLE_MESSAGE_RU` and the `503` are returned when the database fails **while
> the app is running**. When the database is unreachable **at startup**, `PrismaService.onModuleInit`
> calls `$connect()`, the whole process fails to boot, and Caddy returns an empty `502`.
>
> No personal data is at risk either way — this is a UX defect, not a residency one. But a Russian
> visitor who has just filled in a form sees a blank gateway error rather than «попробуйте ещё раз»,
> and is unlikely to resend. That loses exactly the enquiry the campaign paid for.
>
> **Fix applied.** `PrismaService.onModuleInit` now tolerates a failed initial connection **on the RU
> plane only**, so the process starts and the lead endpoint returns its own `503` with the Russian
> retry message. The global plane still rethrows — there, a database down at boot really is a
> deployment failure and failing fast is correct. Residency is untouched: no query succeeds, nothing
> is written, no fallback. Re-tested after redeployment — see §10.

---

## 3. Two latent bugs found by deploying

Neither would ever fire on Render. Both fired on the first RU boot.

1. **Global migrations on startup.** `runMigrations()` deploys the **global** schema. With
   `DATABASE_URL` pointing at Yandex this would have created all thirty global tables inside Russian
   infrastructure, on boot, while reporting a healthy start. Guard added before deployment; observed
   firing in production: `[migrate] LIQVIA_DATA_PLANE=ru — refusing to apply the global schema.`

2. **Demo seeding on startup.** `runDemoSeedOnStartup()` counts `WeeklyActual`, creates demo
   companies and users, and imports sample financial packs. It threw `P2021` and killed the process.

Both are the same shape — *global startup logic assuming the global schema* — and both are now keyed
off `LIQVIA_DATA_PLANE` rather than off someone remembering `SKIP_DB_MIGRATE` / `SKIP_DEMO_SEED`.

The second failure is loud. The first would have been silent, and is the more dangerous of the two.

---

## 4. Still NOT verified

| Item | Status | Why |
|---|---|---|
| Encryption at rest (DB, disk, Lockbox) | **NOT VERIFIED** | The API exposes no encryption field for any of them. §17 says do not infer |
| Backup location / region | **NOT VERIFIED** | No backup-region field exists in the API |
| Restore test (§19) | **PASS** — see §6 | |
| Billing alerts (§20) | **NOT CONFIGURED** | No `yc billing` command exists; console only |
| Lead notification (§23) | **BUILT** — reference-only body, see §9. Operator lead *view* not built | Notification needs `LEAD_NOTIFY_*` config to send |
| Metrica re-verification on the RU origin (§24) | **PASS** — see §7 | |
| Cutover (§30–33) | **NOT DONE** | Requires Cloudflare access |
| Global regression (§29) | **PASS** — 329 backend pass, same 4 pre-existing DB-integration failures as on a clean tree; frontend 36/36 | |

## 5. Break-glass record

Temporary SSH (`0.0.0.0/0`, key-only) was opened twice for deployment and **removed both times**.
Final state verified from the internet: **port 22 closed, port 443 open**. The only ingress rule on
the app security group is TCP 443.


---

## 6. §19 Restore test — **PASS**

A manual backup was taken **after** synthetic data was written, then restored into a temporary,
isolated cluster. Synthetic data only; no genuine lead or client data was involved.

| Step | Result |
|---|---|
| Backup taken | `c9q985emaom0p6128t5r:mdbgckkakje9f77a6c71`, `DONE` |
| Restored into | `liqvia-ru-restore-test` (`c9q9mac8rn8dup8728hg`), private, no public IP |
| **Restore duration** | **413 seconds (~7 minutes)** to `RUNNING` |
| Schema | `CashOsLead, ConsentRecord, _prisma_migrations` — exactly three, **no global tables** |
| Table owners | `ru_migrator` — ownership survived the restore |
| Migration ledger | `20260810130000_ru_lead_plane` |
| `CashOsLead` rows | 2 |
| `RU-RESTORE-PROBE` present | **yes**, `restore@example.invalid`, source `ru_restore_test` |
| `ConsentRecord` rows | 3 |
| Probe consent linked + wording | **yes** — `RESTORE TEST WORDING` |
| Orphaned consent rows | **0** — referential integrity intact |
| Anonymised row preserved | yes |
| FK delete rule after restore | `confdeltype = n` — **SET NULL, not CASCADE** |

That last row matters more than it looks: the non-cascading foreign key is what stops retention
expiry destroying consent evidence, and it survived a full backup/restore cycle rather than
reverting to a default.

**The temporary cluster was deleted after verification** (`c9qmj8entdqi7bgcempa`). Only
`liqvia-ru-leads` remains.

**Recovery expectation:** with a single host, a host failure means roughly **7 minutes of restore
time plus DNS/origin repointing**, not a failover. That is now a measured number rather than an
assumption.

## 7. §24 Metrica on the deployed RU bundle — **PASS**

15 client chunks served by the RU origin were fetched and searched:

| Check | Result |
|---|---|
| Counter `111417446` present | yes |
| `webvisor` anywhere in the bundle | **absent** |
| `setUserID` | **absent** |
| `reachGoal` (goal-only events) | present |
| Host gate references `liqvia.info` | yes |

Consistent with the live measurement taken against the Render site earlier.

## 8. §16 Audit Trails — **ACTIVE**

`liqvia-ru-audit` (`cnpg1ab8v12r60aburtm`), folder-scoped, delivering to Cloud Logging group
`liqvia-ru-logs` via a dedicated service account. Control-plane events only — application personal
data is deliberately not routed here.


## 9. §23 Lead notification — built, not yet enabled

`buildNotificationBody` produces a reference-only message:

```
Новая заявка Liqvia (Россия).
Идентификатор: RU-MBQYMY
Получена: 2026-08-14 09:22 UTC
Кампания: ru_cash_visibility_01

Контактные данные не включены в это письмо намеренно.
Открыть заявку: https://liqvia.info/leads/RU-MBQYMY
```

It is never *given* the name, email, phone, company or comment, so it cannot leak them. The test
asserts the body equals this **exact seven-line template** rather than pattern-matching for contact
details — so the thirty-second "just add the name so I can see it" change fails a test instead of
quietly exporting every Russian lead to a foreign mailbox.

`notify()` never throws: a lead that was stored must not be reported as failed because a mail server
was unreachable. The database row is the evidence, not the email.

**Not yet enabled** — requires `LEAD_NOTIFY_TO` and `LEAD_NOTIFY_SMTP_*`. Until then the reference is
written to the log, which contains no personal data either.

**Still missing: the operator lead view.** The notification links to `/leads/<ref>`, which does not
exist yet. Until it does, retrieving a lead's contact details means a break-glass database query —
workable for the first few leads, not a workflow. This is the single largest gap between "the funnel
works" and "the funnel is operable".

---

## 10. §32/§33 Cutover — EXECUTED and verified

**DNS changed at IONOS on 2026-08-09.** `liqvia.info` now points at the Yandex RU application.

| Record | Before | After |
|---|---|---|
| `A` @ | `216.24.57.1` (Render, Oregon) | **`158.160.44.137`** (Yandex, ru-central1-a) |
| `AAAA` @ | `2405:dc00:0:3::d818:3901` (Render) | **DELETED** |
| `CNAME` www | `liqvia-landing.onrender.com` | **`liqvia.info`** |
| MX / SPF | IONOS | **untouched** |

### The AAAA record was the trap

The apex carried both an A and an AAAA record. The Yandex instance is IPv4-only. Had the AAAA been
left in place, every dual-stack visitor — and browsers *prefer* IPv6 — would have continued reaching
Render, writing leads to **Oregon with no consent record**, while the cutover looked entirely
successful: site loads, form works, certificate valid. Only a database query would have revealed it.

### TLS

Both certificates issued by Let's Encrypt and verifying cleanly (`ssl_verify_result = 0`):

```
liqvia.info      CN=liqvia.info       issuer Let's Encrypt YE2
www.liqvia.info  CN=www.liqvia.info   issuer Let's Encrypt YE1
```

`www` did **not** issue on the first attempt: Caddy tried while `www` still resolved to Render, so
HTTP-01 hit the wrong host, it fell back to TLS-ALPN-01 (unsupported here) and entered a 600-second
backoff. Restarting Caddy after DNS was correct resolved it immediately. **Worth knowing for any
future hostname: issue certificates *after* DNS points at the origin, not before.**

### Live verification through the public domain

| Check | Result |
|---|---|
| `https://liqvia.info/` | **200**, TLS verified |
| `https://www.liqvia.info/` | **200**, TLS verified |
| `/privacy`, `/consent` | **200** |
| Consent checkbox present | **PASS** |
| New consent wording served | **PASS** |
| Old implied-consent wording gone | **PASS** |
| ИНН absent (landing and `/privacy`) | **PASS** |
| Verified contact email on `/privacy` | **PASS** |
| `/.env`, `/login` | **307** — not served on the marketing host |
| Render / Cloudflare headers | **gone** |

### Synthetic lead through the public domain

`RU-CUTOVER-TEST-1786309787` → **HTTP 201**, TLS verified.

```
RU  CashOsLead for mark   : 1
RU  ConsentRecord linked  : 1
RU  textVerified          : t
RU  consent version       : 2026-08-10.1
RU  source                : ru_cutover_test
    logs free of name, email, phone, comment : PASS
```

```
GLOBAL (Oregon) total CashOsLead rows : 4      ← unchanged
GLOBAL (Oregon) rows for cutover mark : 0
GLOBAL (Oregon) any RU-* probe rows   : 0
GLOBAL (Oregon) newest row createdAt  : 2026-08-09T06:52:12Z   ← predates the RU plane
```

**§32 PASS — Oregon received nothing.**

### Propagation

Public resolvers were still serving the old cached A/AAAA at the time of testing (TTL ~50 min), which
is why verification used `--resolve` against the origin. Until the cache drains, some visitors still
reach Render and its old form. **Do not start Yandex Direct spend until `dig liqvia.info` returns
`158.160.44.137` and an empty AAAA from a public resolver.**

### Security posture after cutover

Ingress on `liqvia-ru-app-sg`: **443 and 80 only**. SSH removed and verified closed from the
internet. Port 80 remains open for ACME renewal.

**Note:** automated scanning began within minutes of exposure — the Caddy log shows a bot probing
`/.env`. That is normal for any public IP, and the origin correctly returns 307 for it, but it is a
reminder that Render's CDN is no longer absorbing anything.
