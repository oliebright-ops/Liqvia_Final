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
| Status | RUNNING | ✅ `RUNNING` / health `ALIVE` | |
| Host FQDN | — | `rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net` | |
| Host public IP | **false** | ✅ **`false`** (confirmed in `host list`) | |
| Database | `liqvia_ru` | ✅ `liqvia_ru`, collate/ctype `C` | |
| Connection limit | — | 50 (`liqvia_app`) | |

### 1.3 Residency guard verified against the real host

The fail-closed guard was run against the **actual provisioned hostname**, not a test fixture:

| Case | Result |
|---|---|
| `LIQVIA_DATA_PLANE=ru` + `rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net` | ✅ starts |
| `LIQVIA_DATA_PLANE=ru` + the real `…oregon-postgres.render.com` production host | ✅ **refuses to start** — "must never be written to the global database" |
| global plane + the Render host | ✅ unaffected |

This closes the gap between "the guard passes its own unit tests" and "the guard recognises the
database that actually exists".

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
| TLS | **Required**, `sslmode=verify-full` | ✅ App connects with `sslmode=verify-full&sslrootcert=/certs/root.crt` | Encryption alone is not enough — the CA must be verified, or the connection is spoofable |
| CA certificate | Yandex CA bundled into the app image | ✅ Mounted read-only at `/certs/root.crt` from the host | `verify-full` needs it present at runtime |
| Encryption at rest | Platform default | ❌ **NOT VERIFIED** — see §2.2 | Do not assume |
| Database users | app + migrator | ✅ **`liqvia_app`** (runtime) and **`ru_migrator`** (schema owner) | Separate roles: the runtime must not own DDL |
| `liqvia_app` grants | `SELECT, INSERT, UPDATE`; **no `DELETE`** | ✅ **Verified by execution** — DELETE/TRUNCATE/CREATE/ALTER/DROP all denied. See `RU_PRIVILEGE_EVIDENCE.md` | Erasure and retention must be a deliberate, audited operation |
| Database | `liqvia_ru` | ✅ `liqvia_ru`, **owner `ru_migrator`** | The runtime owns nothing |
| Superuser | Not used by the application | ✅ Not used | |
| Password source | **Yandex Lockbox** | ✅ Secret **`liqvia-ru-db`** (`e6q55rq0rvnbgh3kpu6d`), keys `password`/`username`/`database` | Phase R. Generated at 32 chars from `/dev/urandom`, never printed, never written to Git |
| Connection pooling | Managed pooler | ✅ Port `6432` (pooler) is the only ingress permitted | |

### 2.2 Encryption at rest — NOT VERIFIED, conclusively

§17 requires actual evidence and forbids inference. The complete API surface of all three resources
was enumerated on 2026-08-09:

```
disk    : block_size, created_at, disk_placement_policy, folder_id, hardware_generation, id,
          instance_ids, product_ids, size, source_image_id, status, type_id, zone_id
cluster : config, created_at, deletion_protection, description, environment, folder_id, health,
          id, maintenance_window, monitoring, name, network_id, security_group_ids, status
lockbox : created_at, current_version, description, folder_id, id, name, status
```

**Not one encryption, KMS or key field exists on any of them.** `yc kms symmetric-key list` returns
empty — no customer-managed key is in use anywhere in the folder.

| Item | Status |
|---|---|
| PostgreSQL storage encryption | **NOT VERIFIED** |
| Backup encryption | **NOT VERIFIED** |
| Compute disk encryption | **NOT VERIFIED** |
| Lockbox payload protection | **NOT VERIFIED** (Lockbox is a secrets service and encrypts payloads by design, but the API exposes no field asserting it) |

Yandex documents platform-level encryption at rest, and it is likely present. **That is not
evidence, and this document will not record it as one.** Two ways to convert this into a verifiable
fact, either of which would be an improvement:

1. Create a **customer-managed KMS key** and attach it to the cluster and disk. Encryption then
   becomes an observable property (`kms_key_id` present) rather than a vendor claim, and key access
   becomes auditable.
2. Obtain written confirmation from Yandex for the specific services and record it here with a date
   and a reference.

Until one of those happens, any statement that Russian personal data is encrypted at rest is
**unsupported by evidence available to this project**.

### 2.1 Privilege separation — APPLIED and verified

The cluster was originally created with `liqvia_app` owning `liqvia_ru`. That has been corrected:
`ru_migrator` now owns the database and every table; `liqvia_app` holds `USAGE` on the schema and
`SELECT, INSERT, UPDATE` on tables and sequences, with matching `ALTER DEFAULT PRIVILEGES`.

Verified by executing each statement rather than by inspecting grants — 10/10 as expected. Full
evidence in `RU_PRIVILEGE_EVIDENCE.md`.

*Historical note — the steps that were performed:*

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

**Mechanism chosen: A — a separate RU Prisma schema. Implemented.**

| Option | How | Assessment |
|---|---|---|
| **A. Separate RU Prisma schema** ✅ | `backend/prisma/ru/schema.prisma` — two models, its own `migrations/` dir, its own datasource `RU_DATABASE_URL`, its own generated client output | **Chosen.** Explicit, reviewable, impossible to run the wrong one by accident |
| B. Baseline the RU database | Mark all non-RU migrations as applied without running them | Fragile — one forgotten migration recreates the problem |
| C. Single schema + `@@schema` mapping | Multi-schema Prisma | Adds complexity for no gain here |

Deployed with:

```bash
pnpm --filter @liqvia2/backend prisma:ru:deploy   # migrate deploy --schema prisma/ru/schema.prisma
```

The RU schema reads `RU_DATABASE_URL`, **not** `DATABASE_URL`, so pointing the two planes at each
other requires changing a different variable — a second, independent barrier alongside the runtime
residency guard.

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
| Backup encryption | Platform default | ❌ **NOT VERIFIED** — see §2.2 | Verify and record |

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
