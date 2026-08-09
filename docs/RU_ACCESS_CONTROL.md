# RU access control (Phases R, T)

**Date:** 2026-08-10 · **Status: SPECIFICATION + one live finding**

---

## 1. Live finding — production credentials on a workstation

> ### FINDING (global, current, real)
>
> The repository's root `.env` contains a **live production PostgreSQL connection string**, with
> credentials, for `dpg-…-a.oregon-postgres.render.com/liqviadb`.
>
> That grants full read/write access, from a laptop, to the production database — every
> `CashOsLead` row and the entire authenticated application's data: companies, users, journal
> entries, bank accounts, uploads.
>
> `.env` is correctly gitignored. **Nothing leaked into Git.** The exposure is local.

This is how the lead counts in `RU_CURRENT_LEAD_DATA_FLOW.md` were obtained — which is the point.
It required no approval, produced no attributable record, and would have worked identically against
real personal data.

**Recommended remediation (owner action; not performed here — rotating production credentials is a
STOP CONDITION):**

1. Repoint local `.env` at the Docker Compose database in `docker-compose.yml`.
2. Rotate the Render PostgreSQL credentials.
3. Adopt §4 below for the RU plane from day one, so this pattern is never re-established there.

Recording it because the RU plane will be worthless if it is built correctly and then handed the same
access habits.

---

## 2. Who can do what — the register

Fill the **Who** column with named individuals before cutover. "The team" is not an answer.

| Capability | Who | Mechanism | Notes |
|---|---|---|---|
| View RU leads | | RU-hosted lead view (once built) or `liqvia_app` read | Access logged and attributable |
| Query the RU database directly | | Break-glass only — §4 | Not routine. Time-boxed, justified, audited |
| Export RU records | | Manual, approved per export | **No standing export capability.** Every export is a new copy in a new place |
| View RU backups | | Yandex Cloud IAM | Separate from database access |
| View RU logs | | Cloud Logging IAM | Logs are redacted but treated as sensitive |
| Change RU infrastructure | | Yandex Cloud IAM | Captured by Audit Trails |
| Change Metrica settings | | Yandex account on counter `111417446` | **Includes turning Webvisor on** — see `RU_METRICA_VERIFICATION.md` §5.1 |
| Change Yandex Direct | | Yandex Direct account | Controls spend and targeting |
| Approve legal wording | | — | **Not an engineering capability.** LEGAL REVIEW REQUIRED |

> The Metrica row deserves emphasis. Anyone with console access to counter `111417446` can enable
> Webvisor with two clicks and begin session-replay recording of the Russian lead form — no code
> change, no review, no deployment. It is the shortest path from "compliant" to "recording every
> keystroke of personal data", and it lives entirely outside the repository.

---

## 3. Service identities

| Identity | Grants | Explicitly not granted |
|---|---|---|
| App service account | Lockbox read on its own secrets; write to Cloud Logging | No DB admin, no infrastructure changes, no other secrets |
| DB role `liqvia_app` | `SELECT, INSERT` on `CashOsLead`, `ConsentRecord` | **No `DELETE`**, no DDL, no other schema |
| DB role `liqvia_migrate` | DDL on the RU schema, deploy-time only | Not held by the running application |
| CI/CD | Deploy only | No production data access |

**Least privilege here is load-bearing, not ceremonial.** Because `liqvia_app` has no `DELETE`, a
compromised web tier cannot destroy consent evidence — which is the one artefact that cannot be
reconstructed after the fact.

---

## 4. Break-glass production access

Direct access to the RU database is an exception, never a workflow.

**Preconditions:** synthetic data could not reproduce the problem; logs and metrics were insufficient;
there is a written reason.

**Procedure:**

1. State the reason and the expected duration in writing, before connecting.
2. Use a **named personal credential**, never the application role. Attribution is the point.
3. Grant time-boxed access; revoke on completion, not "later".
4. Prefer aggregate and shape queries. Read personal-data values only when the specific problem
   demands it.
5. **Do not export to a workstation.** No `pg_dump`, no CSV, no screenshots of rows.
6. Audit Trails records the access; the written reason explains it.

**Never:**

- a standing `.env` on any laptop pointing at the RU database;
- a CIDR allow-rule for a home or office IP;
- production data copied into local development, ever.

**Local development uses `docker-compose.yml` with synthetic data.** The seed script and the test
fixtures are the supported way to have realistic data locally.

---

## 5. Secrets (Phase R)

| Secret | Storage | Never |
|---|---|---|
| RU database credentials | **Yandex Lockbox** | In Git, in an image, in user-data, in a `NEXT_PUBLIC_*` variable |
| Application/JWT secrets | Lockbox | — |
| SMTP credentials (if ever) | Lockbox | — |
| Yandex service-account keys | Lockbox / instance service account | — |
| Metrica counter ID | Ordinary config — **it is public by nature** | Do not treat a public ID as a secret; it appears in the page source |

### 5.1 Classification is not the same as sensitivity

Phase R makes a subtle point worth restating: **do not put the operator's ИНН into secret storage
merely because it feels sensitive.**

| Class | Examples | Where it lives |
|---|---|---|
| **Public legal disclosure** | Operator name, legal status, contact address for requests (once verified) | `packages/shared/src/operator.ts` — deliberately public |
| **Private configuration** | ИНН, internal registration references | Environment / Lockbox, via `operatorPrivateConfig()` |
| **Secret** | Database passwords, API keys, tokens | Lockbox only |

The ИНН is *private configuration*, not a *secret*: it is not a credential, nothing is protected by
its confidentiality, and treating it as a secret would obscure that the real question is **whether it
should be published at all**. That question is answered — currently, no — in
`docs/legal/RU_CONSENT_IMPLEMENTATION.md` §1.1. **LEGAL REVIEW REQUIRED** to change it.

`operatorPrivateConfig()` throws if called in a browser, so a private identifier cannot reach a
client bundle even by mistake.

---

## 6. Foreign access — an open question

The people who build and operate this infrastructure are not in Russia. That means Russian personal
data will be **administratively accessible from outside Russia**, even though it is *stored* inside it.

Data residency and access jurisdiction are different things, and satisfying the first does not
address the second.

This affects: who holds Yandex Cloud IAM, who can break-glass, who can read logs, who can enable
Webvisor, and whether any of that carries obligations or restrictions.

> **LEGAL / COMPLIANCE REVIEW REQUIRED.** Listed in `RU_YANDEX_CLOUD_ARCHITECTURE.md` §7. Not
> solvable in code, and not resolved by this document.

---

## 7. Pre-cutover checklist

- [ ] Every **Who** cell in §2 names an individual
- [ ] Local `.env` no longer points at any production database
- [ ] Render production credentials rotated
- [ ] RU database has no public IP and no CIDR allow-rules
- [ ] `liqvia_app` confirmed to have no `DELETE` grant
- [ ] All RU secrets in Lockbox; none in Git, images or user-data
- [ ] Audit Trails enabled **before** the first deployment
- [ ] Metrica counter access list reviewed; unnecessary accounts removed
- [ ] Break-glass procedure agreed and written down
- [ ] Foreign-access question referred for legal review
