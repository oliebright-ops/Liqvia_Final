# Yandex Cloud — resources and estimated monthly cost

**Date:** 2026-08-10 · **Required by owner decision #10, before any resource is created.**
**Status: PARTIALLY PROVISIONED — see §0.**

## 0. What was actually provisioned (2026-08-09)

The owner selected **MINIMUM SAFE**, not RECOMMENDED PILOT. Created so far:

| Resource | Actual | Billable |
|---|---|---|
| `liqvia-ru-app-sg` (`enpstavb3fb7ri48q6u3`) | Security group | **₽0** — free |
| `liqvia-ru-db-sg` (`enpfqu7oggatejl2havl`) | Security group | **₽0** — free |
| `liqvia-ru-leads` (`c9q985emaom0p6128t5r`) | Managed PostgreSQL 18.4, **`b2.medium`** (2 vCPU burstable / 4 GB), **1 host**, 10 GB network-ssd, `ru-central1-a` | **Yes** |
| `liqvia-ru-db` (`e6q55rq0rvnbgh3kpu6d`) | Lockbox secret, 1 version | Negligible |

**Correction to this document:** the preset `b3-c1-m4` named below **does not exist** in this
account. The only burstable presets offered are `b1.medium` and `b2.medium`, both 2 vCPU / 4 GB.
`b2.medium` was used. Both MINIMUM SAFE and RECOMMENDED PILOT figures below were built on the
non-existent preset and are therefore **estimates against the wrong SKU** — treat the tables as
order-of-magnitude only until a real invoice or the console's billing page is read.

**Not yet created:** Compute instance (app runtime), Cloud Logging, Audit Trails.

---

> **Prices are indicative, not quoted.** They are list-price estimates for `ru-central1` and have
> **not** been read from a live Yandex Cloud console — I have no credentials for the account.
> Confirm against the Yandex pricing calculator before provisioning. Amounts exclude VAT (НДС 20%).

---

## 1. Recommendation, and what was chosen

My recommendation was **RECOMMENDED PILOT**: the ~₽1,700/month difference buys a database that
survives a host failure, which is not usually the place to save money when the store holds real
people's personal data.

**The owner selected MINIMUM SAFE** (2026-08-10) and that is what was built. The recommendation is
left here unedited so the decision and its reasoning both remain on the record.

The single-host consequence is bounded, and worth stating precisely: a host failure is an outage
recovered from backup, not a failover. Because the residency guard fails closed, an unreachable RU
database returns `503` and writes nothing to Oregon — so the exposure is **lost enquiries**, never
Russian personal data in the wrong jurisdiction. Adding a second host later is an online operation.

---

## 2. RECOMMENDED PILOT

| Resource | Spec | Est. ₽/month |
|---|---|---|
| Managed PostgreSQL | `b3-c1-m4` burstable, 1 vCPU / 4 GB, **2 hosts** (HA), 20 GB network SSD | ~3,400 |
| Compute Cloud | `standard-v3`, 2 vCPU (20% guaranteed) / 2 GB, 20 GB SSD | ~1,100 |
| VPC + 1 static public IP | Egress well under 100 GB | ~200 |
| Lockbox | ~4 secrets, negligible operations | ~50 |
| Cloud Logging | < 1 GB/month at this volume | ~100 |
| Audit Trails | Delivery to Cloud Logging | ~0–100 |
| Backups | Included up to cluster size; 7-day retention | ~0–150 |
| **Total** | | **≈ ₽5,000–6,500** |

## 3. MINIMUM SAFE

| Resource | Spec | Est. ₽/month |
|---|---|---|
| Managed PostgreSQL | `b3-c1-m4`, **1 host**, 10 GB SSD | ~1,700 |
| Compute Cloud | `standard-v3`, 2 vCPU (5% guaranteed) / 2 GB | ~600 |
| VPC + static IP | | ~200 |
| Lockbox + Logging + Audit Trails | | ~150 |
| **Total** | | **≈ ₽2,650–3,300** |

**What you give up:** a single database host means a host failure is an outage with a restore-from-backup
recovery, not a failover. At 5% guaranteed vCPU the app is throttle-prone under any burst — including
a launch-day traffic spike, which is exactly when you least want it.

**Adequate for:** a pre-launch environment used only for the Phase W synthetic tests.

---

## 4. Sizing rationale

Deliberately small, and defensible:

- **Two tables, one form.** Even an optimistic Direct campaign produces tens of leads a day. A lead
  row is well under 1 KB — 10,000 leads is under 10 MB. Storage is dominated by the minimum
  allocation, not by data.
- **The one-month retention ceiling caps growth permanently.** Personal data is erased in place after
  30 days, so the database does not grow without bound. Storage never needs revisiting.
- **Burstable (`b3`) is the right class.** The workload is idle punctuated by a form POST. Paying for
  guaranteed vCPU would buy capacity that is unused ~99% of the time.
- **No Object Storage, no Redis, no queue, no Kubernetes.** Nothing in the funnel needs them, and each
  would be another store to secure, back up, retain and delete.

**Not included, and not needed yet:** Yandex Direct advertising spend (separate budget, your
decision), and domain/Cloudflare costs (unchanged).

## 5. Cost risks

| Risk | Mitigation |
|---|---|
| Egress if the landing page serves large assets from the instance | Static assets are served through Cloudflare; egress should stay negligible |
| Log volume growth | Redaction already limits volume; set a Cloud Logging retention period at creation |
| Idle over-provisioning | Start at the sizes above. Scale up on evidence, never in anticipation |
| Forgotten test resources | Provision in a dedicated folder so everything is visible and deletable together |

## 6. Before provisioning

1. Confirm these figures against the Yandex pricing calculator for `ru-central1`.
2. Confirm the billing account and **which entity contracts with Yandex Cloud** — an open item in
   `RU_YANDEX_CLOUD_ARCHITECTURE.md` §7 and **not** an engineering question.
3. Set a **billing alert** at ~₽10,000/month so a misconfiguration surfaces as an email rather than
   as an invoice. **Still outstanding — recommended now that billable resources exist.**

## 7. Outstanding cost actions

- [ ] Read the **actual** daily spend from the console billing page and compare against §3
- [ ] Confirm the **grant amount and expiry**, so burn can be tracked against it
- [ ] Set the billing alert
- [ ] Delete the cluster if the RU plane is abandoned — it bills whether or not it is used
