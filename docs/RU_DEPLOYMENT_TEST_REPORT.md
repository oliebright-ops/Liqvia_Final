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
> **Fix (not yet applied):** make `PrismaService.onModuleInit` tolerate a failed initial connection
> and let requests fail individually, or add a Caddy `handle_errors` block returning the Russian
> message. The first is better — it keeps the health endpoint honest.

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
| Restore test (§19) | **NOT PERFORMED** | |
| Billing alerts (§20) | **NOT CONFIGURED** | No `yc billing` command exists; console only |
| Lead notification / operator access (§23) | **NOT BUILT** | |
| Metrica re-verification on the RU origin (§24) | **NOT DONE** | Requires public DNS pointing at the origin |
| Cutover (§30–33) | **NOT DONE** | Requires Cloudflare access |
| Global regression (§29) | **NOT RUN** | |

## 5. Break-glass record

Temporary SSH (`0.0.0.0/0`, key-only) was opened twice for deployment and **removed both times**.
Final state verified from the internet: **port 22 closed, port 443 open**. The only ingress rule on
the app security group is TCP 443.
