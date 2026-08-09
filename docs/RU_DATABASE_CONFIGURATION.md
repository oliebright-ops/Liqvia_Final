# RU database configuration (Phase F)

**Date:** 2026-08-10 · **Status: PROVISIONED.** Cluster `liqvia-ru-leads` (`c9q985emaom0p6128t5r`)
created 2026-08-09T18:39Z in `ru-central1`.

> ## How to use this document
>
> Every table has an **Intended** column and a **Verified** column. The Verified column is filled in
> by reading the **actual setting back from the Yandex Cloud API** after provisioning — never by
> copying the Intended value across. Where the two differ, the difference is stated rather than
> quietly reconciled.
>
> A database created and then documented as "152-FZ compliant" without that step is exactly the
> failure this phase exists to prevent.

---

## 1. Cluster

Verified via `yc managed-postgresql cluster get c9q985emaom0p6128t5r` on 2026-08-09.

| Setting | Intended | **Verified** | Why |
|---|---|---|---|
| Service | Managed Service for PostgreSQL | ✅ Managed Service for PostgreSQL | Managed backups, patching, PITR |
| Cluster id | — | `c9q985emaom0p6128t5r` | |
| Region | `ru-central1` | ✅ `ru-central1`, zone **`ru-central1-a`** | The residency requirement |
| Availability zones | ≥ 1; more if HA wanted | ⚠️ **1 host** — see §1.1 | Owner selected MINIMUM SAFE |
| PostgreSQL version | 16 or later | ✅ **18.4** | Exact parity with production global (18.4) — no version-behaviour surprises |
| Host class | Smallest viable | ⚠️ **`b2.medium`** (2 vCPU burstable, 4 GB) — see §1.2 | Two tables, low write volume |
| Disk type | Network SSD | ✅ `network-ssd` | |
| Disk size | Smallest viable | ✅ **10 GB** | The 1-month retention ceiling caps growth permanently |
| Public access | **DISABLED** | ✅ `access: {}` — no public access, no DataLens, no WebSQL; host created with `assign-public-ip=false` | Phase S |
| Environment | production | ✅ `PRODUCTION` | |
| Deletion protection | not originally specified | ✅ **enabled** | Added deliberately: this store holds personal data, and an accidental `delete` is unrecoverable |
| Network | `default` | ✅ `enpr97snu8brr3210h7r` | Same VPC as the app |
| Cluster name | `liqvia-ru-leads` | ✅ `liqvia-ru-leads` | Names the scope, so nobody assumes it is the global database |

### 1.1 Deviation — single host, and what it costs you

Specified as "≥ 1, more if HA wanted"; **provisioned with one host**, on the owner's explicit
selection of MINIMUM SAFE over RECOMMENDED PILOT (2026-08-10).

**Consequence, stated plainly:** a host failure is an **outage**, recovered by restore-from-backup,
not a failover. Expect hours, not seconds.

**Why it is nevertheless defensible here:** the fail-closed guard means an unreachable RU database
causes submissions to return `503` with a retry message and write **nothing** to the global
database. So the exposure is *lost enquiries during the outage* — never Russian personal data in the
wrong jurisdiction. That is a commercial cost, not a compliance one.

**Revisit** when the funnel carries real spend: adding a second host is an online operation and does
not require rebuilding the cluster.

### 1.2 Deviation — host class

`RU_YANDEX_COST_ESTIMATE.md` named `b3-c1-m4`. **That preset does not exist in this account.** The
available burstable presets are `b1.medium` and `b2.medium` (both 2 vCPU / 4 GB); `b2.medium` was
selected as the newer generation with wider zone coverage. The estimate has been corrected.

## 2. Security

| Setting | Intended | **Verified** | Why |
|---|---|---|---|
| TLS | **Required**, `sslmode=verify-full` | ⏳ Enforced by Managed PostgreSQL; **`verify-full` still to be set in the app's connection string** | Encryption alone is not enough — the CA must be verified, or the connection is spoofable |
| CA certificate | Yandex CA bundled into the app image | ⏳ Pending app deployment | `verify-full` needs it present at runtime |
| Encryption at rest | Platform default | ⏳ **Not yet read back** — record before cutover | Do not assume |
| Database users | `liqvia_app` (app), `liqvia_migrate` (migrations) | ⚠️ **`liqvia_app` only** — `liqvia_migrate` not yet created | Separate roles: the runtime must not own DDL |
| `liqvia_app` grants | `SELECT, INSERT`; **no `DELETE`** | ⚠️ **Owner of `liqvia_ru`** — broader than intended, see §2.1 | Erasure and retention must be a deliberate, audited operation |
| Database | `liqvia_ru` | ✅ `liqvia_ru`, owner `liqvia_app` | |
| Superuser | Not used by the application | ✅ Not used | |
| Password source | **Yandex Lockbox** | ✅ Secret **`liqvia-ru-db`** (`e6q55rq0rvnbgh3kpu6d`), keys `password`/`username`/`database` | Phase R. Generated at 32 chars from `/dev/urandom`, never printed, never written to Git |
| Connection pooling | Managed pooler | ✅ Port `6432` (pooler) is the only ingress permitted | |

### 2.1 Open — privilege separation not yet applied

The cluster was created with a single user, `liqvia_app`, which **owns** the `liqvia_ru` database and
therefore holds `DELETE` and DDL. That is broader than §2 specifies.

**To do before cutover** (all online, no rebuild):

1. Create `liqvia_migrate`; transfer schema ownership to it.
2. Reduce `liqvia_app` to `SELECT, INSERT, UPDATE` on `CashOsLead` and `ConsentRecord`.
3. Revoke `DELETE` from `liqvia_app`.

Step 3 is the one that matters: without it a compromised web tier can destroy consent evidence, which
is the one artefact that cannot be reconstructed. The retention job erases by **`UPDATE`**, not
`DELETE`, so removing `DELETE` does not break it — that was deliberate in the retention design.

**Retention interaction:** `ConsentRecord.cashOsLeadId` is `ON DELETE SET NULL`, so consent evidence
survives even a hard delete of a lead.

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

| Setting | Intended | **Verified** | Why |
|---|---|---|---|
| Automated backups | Enabled | ✅ Enabled | |
| Backup region | **Same RU region as the cluster** | ⏳ **Not independently confirmed** — Managed PostgreSQL keeps backups within the cluster's region, but this has not been read back from an API field. **Confirm before cutover** | A backup outside Russia defeats residency as completely as the primary being outside it |
| Retention | To be decided with the lead retention period | ✅ **7 days** | See §4.1 — this is *shorter* than the lead retention ceiling, which is the correct direction |
| Backup window | Low-traffic hours, MSK | ✅ **22:15 UTC** (01:15 MSK) | |
| PITR | Confirm availability and window | ⏳ Within the 7-day backup retention; window not yet exercised | |
| **Restore test** | **Performed before cutover** | ❌ **NOT PERFORMED** | An untested backup is a belief, not a backup |
| Backup encryption | Platform default | ⏳ Not yet read back | Verify and record |

### 4.1 Retention interaction — the one number to keep consistent

Three periods have to stay in a sensible order, and they currently do:

| | Period | Source |
|---|---|---|
| Lead personal data | **≤ 30 days** | Owner decision, enforced by `LeadRetentionService` |
| Database backups | **7 days** | This cluster |
| Consent evidence | **undecided — REVIEW REQUIRED** | `RU_MINIMUM_SCHEMA.md` §4 |

Backups (7d) are shorter than the retention ceiling (30d). That matters: a backup that outlived the
retention period would quietly resurrect personal data the policy says was erased, and a subject
asking "have you deleted my data?" could not be answered truthfully. Keep backup retention **below**
the lead ceiling whenever either is changed.

> Backups are where residency quietly fails. The cluster is in Russia and everyone relaxes; the
> backup destination is a separate setting, defaults are not guaranteed to match, and nobody looks at
> it again. **Read this setting in the console and write down what it actually says.**

## 5. Network exposure

| Setting | Intended | **Verified** |
|---|---|---|
| Public IP | **None** | ✅ Host created `assign-public-ip=false`; cluster `access: {}` |
| Security group ingress | PostgreSQL port from the **app security group only**, by group reference | ✅ `liqvia-ru-db-sg` (`enpfqu7oggatejl2havl`): ingress TCP **6432** with `security_group_id: enpstavb3fb7ri48q6u3` |
| CIDR-based allow rules | **None**, including office/home IPs | ✅ **Zero CIDR ingress rules.** The only ingress rule is the group reference above |
| Subnet | Private | ✅ `default-ru-central1-a` (`e9b3fq4l4m1mbps9vp2p`, 10.128.0.0/24) |
| Egress | Default | ✅ Any → 0.0.0.0/0 (managed-service operation) |

**Attached security groups on the cluster:** `['enpfqu7oggatejl2havl']` — the database group only.

The app group `liqvia-ru-app-sg` (`enpstavb3fb7ri48q6u3`) allows ingress TCP 443 from `0.0.0.0/0`
and egress anywhere. The database is reachable **only** by workloads carrying that app group; there
is no address from which a laptop can connect directly. This is what makes the break-glass procedure
in `RU_ACCESS_CONTROL.md` §4 a deliberate act rather than a habit.

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
