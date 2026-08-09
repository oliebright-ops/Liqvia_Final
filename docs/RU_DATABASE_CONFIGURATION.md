# RU database configuration (Phase F)

**Date:** 2026-08-10 · **Status: SPECIFICATION — the database does not exist yet.**

> ## How to use this document
>
> Every table below has an **Intended** column and a **Verified** column. The Verified column is
> **empty on purpose**. It is filled in from the actual Yandex Cloud console *after* provisioning, by
> reading the real setting — not by copying the intended value across.
>
> A database created and then documented as "152-FZ compliant" without that step is exactly the
> failure this phase exists to prevent. **Creating the cluster is a billable STOP CONDITION.**

---

## 1. Cluster

| Setting | Intended | Verified (fill from console) | Why |
|---|---|---|---|
| Service | Managed Service for PostgreSQL | | Managed backups, patching, PITR |
| Region | `ru-central1` | | The residency requirement |
| Availability zones | ≥ 1; 3 hosts if HA is wanted | | Single host is acceptable for a lead funnel; state the choice explicitly |
| PostgreSQL version | 16 or later | | Production global runs 18.4; the RU plane has no version dependency |
| Host class | Smallest viable (`s3-c2-m8` class or lower) | | Two tables, low write volume |
| Disk type | Network SSD | | |
| Disk size | Smallest viable | | Lead rows are tiny; avoid provisioning for imagined scale |
| Public access | **DISABLED** | | Phase S. The database is reachable only from the app's subnet |
| Cluster name | `liqvia-ru-leads` | | Names the scope, so nobody assumes it is the global database |

## 2. Security

| Setting | Intended | Verified | Why |
|---|---|---|---|
| TLS | **Required**, `sslmode=verify-full` | | Encryption alone is not enough — the CA must be verified, or the connection is spoofable |
| CA certificate | Yandex CA bundled into the app image | | `verify-full` needs it present at runtime |
| Encryption at rest | Platform default | | **Verify what the platform actually provides** and record it. Do not assume |
| Database users | `liqvia_app` (app), `liqvia_migrate` (migrations) | | Separate roles: the runtime must not own DDL |
| `liqvia_app` grants | `SELECT, INSERT` on both tables; `UPDATE` only if a lead status field is added | | **No `DELETE`.** Erasure and retention run as a separate, deliberate, audited operation |
| `liqvia_migrate` grants | DDL on the RU schema only | | Used at deploy time, not held by the running app |
| Superuser | Not used by the application | | |
| Password source | **Yandex Lockbox** | | Phase R. Never in Git, never in an image, never in user-data |
| Connection pooling | Managed pooler | | |

> **On `DELETE`:** withholding it from the runtime role means an application bug, an injection, or a
> compromised instance cannot erase lead or consent records. Erasure requests and retention expiry
> are deliberate operations under `RU_ACCESS_CONTROL.md`, not something the web tier can do.

## 3. Schema — and the trap that must be avoided

The RU database contains **exactly two tables**: `CashOsLead` and `ConsentRecord`
(see `RU_MINIMUM_SCHEMA.md`).

> ### ⚠️ The `_prisma_migrations` trap
>
> Running `prisma migrate deploy` with the existing `backend/prisma/migrations/` directory against a
> fresh Yandex database **will create all 30 tables**, silently defeating the entire purpose of this
> migration. The migration history is a ledger of the *global* schema.
>
> This is the single most likely way for this project to go wrong, because the command that does it
> is the command everyone types by reflex.

**Required mechanism — choose one and record which:**

| Option | How | Assessment |
|---|---|---|
| **A. Separate RU Prisma schema** | `backend/prisma/ru/schema.prisma` with the two models and its own `migrations/` dir; deploy with `--schema` | **Recommended.** Explicit, reviewable, impossible to run the wrong one by accident |
| B. Baseline the RU database | Mark all non-RU migrations as applied without running them | Fragile — one forgotten migration recreates the problem |
| C. Single schema + `@@schema` mapping | Multi-schema Prisma | Adds complexity for no gain here |

**Verification after applying (mandatory, part of Phase W):**

```sql
-- Must return exactly: CashOsLead, ConsentRecord, _prisma_migrations
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY 1;

-- Must contain ONLY the two RU migrations
SELECT migration_name FROM _prisma_migrations ORDER BY started_at;
```

If either query returns anything else, **stop and rebuild the database.** Do not drop the extra
tables and continue — a database that once held the global schema has an unclear provenance, and
provenance is the thing this whole exercise is about.

## 4. Backup and recovery

| Setting | Intended | Verified | Why |
|---|---|---|---|
| Automated backups | Enabled | | |
| Backup region | **Same RU region as the cluster** | | **Verify explicitly.** A backup outside Russia defeats residency as completely as the primary being outside it |
| Retention | To be decided with the lead retention period | | Backups must not outlive the retention period they are backing up — see `RU_MINIMUM_SCHEMA.md` §4 |
| Backup window | Low-traffic hours, MSK | | |
| PITR | Confirm availability and window | | |
| **Restore test** | **Performed before cutover** | | An untested backup is a belief, not a backup |
| Backup encryption | Platform default | | Verify and record |

> Backups are where residency quietly fails. The cluster is in Russia and everyone relaxes; the
> backup destination is a separate setting, defaults are not guaranteed to match, and nobody looks at
> it again. **Read this setting in the console and write down what it actually says.**

## 5. Network exposure

| Setting | Intended | Verified |
|---|---|---|
| Public IP | **None** | |
| Security group ingress | PostgreSQL port from the **app security group only**, by group reference | |
| CIDR-based allow rules | **None**, including office/home IPs | |
| Subnet | Private | |
| Egress | Default | |

## 6. Access

Recorded in full in `RU_ACCESS_CONTROL.md`. Summary:

| Role | Access |
|---|---|
| Application service account | Lockbox read (its own secrets); DB via `liqvia_app` |
| Migration runner | `liqvia_migrate`, deploy-time only |
| Operator (human) | Cloud console; **no routine direct DB access** |
| Developers | **None to the RU database.** Local development uses `docker-compose.yml` with synthetic data |

## 7. Monitoring

| Signal | Why |
|---|---|
| Connection count / rejections | Detects a failing residency guard or a misconfigured app |
| Disk usage | Trivial for two tables; catches runaway writes |
| Backup success/failure | **Alert on failure.** A silently failing backup is the classic disaster |
| Failed auth attempts | Attack signal on a database that should see connections from exactly one source |
| Insert rate on `CashOsLead` | Business signal *and* abuse signal |

## 8. What this document does not establish

Filling in every Verified cell proves the database is **in Russia, private, encrypted in transit,
backed up in-region and least-privileged**.

It does **not** establish that Liqvia complies with 152-FZ. It says nothing about lawful basis,
consent wording, retention periods, subject rights, operator notification, or the corporate and
sanctions questions in `RU_YANDEX_CLOUD_ARCHITECTURE.md` §7.

**LEGAL REVIEW REQUIRED. Do not describe this database as "152-FZ compliant" in any public or
contractual statement.**
