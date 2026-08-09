# Yandex Cloud — resources and estimated monthly cost

**Date:** 2026-08-10 · **Required by owner decision #10, before any resource is created.**
**Status: NOTHING PROVISIONED.**

> **Prices are indicative, not quoted.** They are list-price estimates for `ru-central1` and have
> **not** been read from a live Yandex Cloud console — I have no credentials for the account.
> Confirm against the Yandex pricing calculator before provisioning. Amounts exclude VAT (НДС 20%).

---

## 1. Recommendation

**RECOMMENDED PILOT — ≈ ₽5,000–6,500 / month (≈ ₽6,000–7,800 incl. VAT).**

The difference from the bare minimum is roughly **₽1,700/month**, and it buys the two things whose
absence is expensive rather than inconvenient: a database that survives a host failure, and backups
that are actually retained. For a funnel that will hold real people's personal data under Russian
law, that is not the place to save ₽1,700.

There is no material cost gap to surface — both options are small. **Proceeding with RECOMMENDED
PILOT**, per your instruction.

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
   as an invoice.

**No resource will be created until you confirm.**
