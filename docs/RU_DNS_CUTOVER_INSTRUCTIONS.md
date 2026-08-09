# liqvia.info DNS cutover — exact steps

**Origin is ready and waiting.** `158.160.44.137` is serving on 80 and 443, SSH is closed.
The only remaining step is the DNS change at IONOS, which must be made by the account holder —
`my.ionos.com` is blocked by browsing policy for the assistant's tooling.

---

## ⚠️ The one that will bite you: the AAAA record

The apex has **both** an A and an AAAA record:

```
liqvia.info  A     216.24.57.1                        → Render (US Oregon)
liqvia.info  AAAA  2405:dc00:0:3::d818:3901           → Render (US Oregon)
```

**The Yandex instance is IPv4-only.** If you change the A record and leave the AAAA in place, every
dual-stack visitor — and browsers *prefer* IPv6 — keeps reaching Render, and their lead is written
to the **Oregon** database with no consent record.

That is the precise failure this whole migration exists to prevent, and it would look like a
successful cutover: the site would load, the form would work, and only a database query would reveal
that half the leads went to the wrong country.

**The AAAA record must be deleted, not edited.**

---

## Changes to make at IONOS

`my.ionos.com` → **Domains & SSL** → `liqvia.info` → **Adjust DNS settings**

| Action | Type | Name | Current value | New value | TTL |
|---|---|---|---|---|---|
| **EDIT** | A | `@` (liqvia.info) | `216.24.57.1` | **`158.160.44.137`** | **300** |
| **DELETE** | AAAA | `@` (liqvia.info) | `2405:dc00:0:3::d818:3901` | *(remove entirely)* | — |
| **EDIT** | CNAME | `www` | `liqvia-landing.onrender.com` | **`liqvia.info`** | **300** |

**Do not touch** the MX records (`mx00/mx01.ionos.com`), the SPF TXT record, or the nameservers.
Email is unrelated to this change and breaking it is easy.

Set TTL to **300 seconds** on both records. That is what makes rollback fast.

---

## Rollback (keep this to hand)

| Type | Name | Restore to |
|---|---|---|
| A | `@` | `216.24.57.1` |
| AAAA | `@` | `2405:dc00:0:3::d818:3901` |
| CNAME | `www` | `liqvia-landing.onrender.com` |

Rollback is **TTL-bound**, not instant. With TTL 300 set beforehand it takes about five minutes.

---

## What to expect, and when

The current TTL is **~3000 seconds (50 minutes)** on the A record and **3600s** on `www`. That is the
window during which some resolvers still send visitors to Render.

| Time | State |
|---|---|
| 0 min | Change made. New resolvers get Yandex; cached resolvers still get Render |
| 0–2 min | Caddy obtains a Let's Encrypt certificate over HTTP-01 on port 80 |
| ~50 min | Old A-record TTL fully expired; all traffic on Yandex |
| ~60 min | `www` TTL expired |

**During the transition window, a visitor routed to Render gets the OLD form** — implied consent, no
checkbox, `/privacy` unreachable — and their lead goes to Oregon. There have been **zero real leads
ever**, so the practical exposure is near nil, but do not start Yandex Direct spend until
propagation is complete.

### A brief certificate warning is possible

Until Caddy completes issuance (usually under two minutes after DNS resolves here), visitors may see
a certificate warning, because Render's CDN is no longer terminating TLS on a valid certificate.
Port 80 is open for the HTTP-01 challenge and Caddy retries automatically.

---

## Verify immediately after the change

Run these, or ask the assistant to:

```bash
dig +short liqvia.info A          # expect 158.160.44.137
dig +short liqvia.info AAAA       # expect EMPTY — this is the important one
curl -sS -o /dev/null -w '%{http_code} %{remote_ip}\n' https://liqvia.info/api/health
curl -sSI https://liqvia.info/ | grep -i server    # should NOT say cloudflare
```

`server: cloudflare` still appearing means you are still hitting Render.

Then the full post-cutover suite (§33): consent checkbox present, `/privacy` and `/consent`
reachable, ИНН absent, contact email correct, synthetic lead lands in RU PostgreSQL, Oregon receives
nothing, logs clean, Metrica clean.

---

## Not yet done, independent of DNS

- **Billing alerts** — console only, no CLI. Set one at ~₽10,000/month.
- **Encryption at rest** — NOT VERIFIED. No API field exists; needs a customer-managed KMS key or
  written confirmation from Yandex.
- **Operator lead view** — `/leads/<ref>` does not exist yet. Until it does, reading a lead's contact
  details requires a break-glass database query.
- **`ConsentRecord` retention period** — REVIEW REQUIRED.
