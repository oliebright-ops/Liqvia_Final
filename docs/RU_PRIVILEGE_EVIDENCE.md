# RU database privilege separation — evidence (§3, §4, §8, §10, §22)

**Date:** 2026-08-09 · **Cluster:** `liqvia-ru-leads` (`c9q985emaom0p6128t5r`)
**Method:** real SQL executed against the live database from inside the VPC. Not privilege
inspection — every statement was actually attempted and its outcome recorded.

---

## 1. Roles

| Role | Purpose | Owns | Lockbox secret |
|---|---|---|---|
| `ru_migrator` | Schema owner. DDL and migrations. Deployment step only. | `liqvia_ru` database, `public` schema objects, all three tables | `liqvia-ru-db-migrator` (`e6q71jiluklhdpsr62ka`) |
| `liqvia_app` | Application runtime. | **Nothing** | `liqvia-ru-db` (`e6q55rq0rvnbgh3kpu6d`) |

The database was originally created with `liqvia_app` as owner. It was **recreated** owned by
`ru_migrator` while empty — deletion protection was toggled off for the operation and **restored
immediately afterwards** (verified: `deletion_protection: True`). No data existed at any point.

**The two credentials are in separate Lockbox secrets, and the application's service account
(`liqvia-ru-app-sa`) has a `lockbox.payloadViewer` binding on the runtime secret only.** It has no
binding on the migrator secret, so the runtime cannot read the migrator credential even if it tries.
The migrator credential was supplied to the deployment step over SSH and never written to the
instance's persistent configuration.

## 2. §10 — privilege evidence

Executed as `liqvia_app` (confirmed `current_user: liqvia_app`) against the real tables:

| Operation | Expected | Actual | Result |
|---|---|---|---|
| `SELECT` | ALLOWED | ALLOWED | **PASS** |
| `INSERT` | ALLOWED | ALLOWED | **PASS** |
| `UPDATE` | ALLOWED | ALLOWED | **PASS** |
| `DELETE` on `CashOsLead` | DENIED | DENIED | **PASS** |
| `TRUNCATE` on `CashOsLead` | DENIED | DENIED | **PASS** |
| `CREATE TABLE` | DENIED | DENIED | **PASS** |
| `ALTER TABLE` | DENIED | DENIED | **PASS** |
| `DROP TABLE` | DENIED | DENIED | **PASS** |
| `DELETE` on `ConsentRecord` | DENIED | DENIED | **PASS** |
| `TRUNCATE` on `ConsentRecord` | DENIED | DENIED | **PASS** |

**10/10 PASS.**

The probe row inserted by the test could not be removed by `liqvia_app` — it had to be deleted by
`ru_migrator`. That is the separation working, demonstrated rather than asserted.

### Grants applied

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM liqvia_app;
GRANT USAGE ON SCHEMA public TO liqvia_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO liqvia_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO liqvia_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ru_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO liqvia_app;
```

The `ALTER DEFAULT PRIVILEGES` lines matter: without them, a table created by a *future* migration
would be inaccessible to the runtime, and the tempting fix under deployment pressure is to hand
ownership back. This removes that pressure.

## 3. §4 / §5 — why removing DELETE does not break retention

The retention design erases lead personal data by **`UPDATE`**, overwriting every identifying column
in place and stamping `anonymisedAt`. It never issues `DELETE`.

That was a deliberate choice made before these grants existed, and it is what makes this hardening
possible: the runtime can satisfy the one-month retention obligation **without ever holding the
privilege that would let it destroy consent evidence.**

`ConsentRecord.cashOsLeadId` is additionally `ON DELETE SET NULL`, so even a hard delete performed
by the migrator cannot cascade away the evidence.

Three independent layers now protect consent evidence:

1. the application never issues `DELETE` (design);
2. the runtime role **cannot** issue `DELETE` (privilege, proven above);
3. the foreign key does not cascade (schema).

## 4. §8 — schema isolation

```
CashOsLead          (owner ru_migrator)
ConsentRecord       (owner ru_migrator)
_prisma_migrations  (owner ru_migrator)
```

Exactly three tables. **No `Company`, `UserProfile`, `JournalEntry`, `BankAccount`, `UploadBatch`,
`AiLog` or any other global structure is present.** The migration ledger contains one entry:
`20260810130000_ru_lead_plane`.

Applied with checksum `e2c1e3b6c4a19301ea5eed9ae209822ffe2b563f98f65ef6db88bd6fcc5dca35`.

## 5. §22 — network

| Check | Result |
|---|---|
| PostgreSQL public IP | `false` |
| DB reachable from the RU app instance | ✅ `10.128.0.32:6432` — connection succeeded |
| DB hostname resolvable from a laptop | ❌ does not resolve — private FQDN |
| DB reachable from a laptop | ❌ unreachable |
| App instance SSH from internet | ❌ **closed** — the temporary break-glass rule was removed and re-verified closed |

The only ingress on the app security group is TCP 443 from `0.0.0.0/0`.

### Break-glass record

A temporary SSH rule was opened to perform this work and **has been removed**. It was open for
approximately 25 minutes on an instance with key-only authentication (`ssh_pwauth: no`), holding no
personal data. Sequence: `/32` scoped to the workstation → widened to `0.0.0.0/0` because the
workstation is behind carrier-grade NAT and its IPv4 source address is not stable → **deleted**, and
closure verified from the internet.

This is exactly the pattern `RU_ACCESS_CONTROL.md` §4 describes: deliberate, time-boxed, recorded.
It must not become standing access.

## 6. Still outstanding

- `liqvia_app` retains `CONNECT` on `liqvia_ru` — correct and required.
- A **restore test has not been performed** (§19).
- Encryption at rest is **NOT VERIFIED** — see `RU_DATABASE_CONFIGURATION.md`; the API exposes no
  encryption field for the cluster, the disk, or the Lockbox secret.
