# RU landing page — uptime monitoring

## Why this exists

Between **1 and 10 September 2026** `liqvia.info` was unreachable and nobody
noticed for nine days.

The cause was not a bug. Yandex's automated billing-enforcement actor,
`yc.iam.reaper`, set both the compute instance `liqvia-ru-app` and the
`liqvia-ru-leads` Postgres cluster to `STOPPED` at `2026-09-01T22:35:34Z` when
the billing account was suspended — the cloud was created on 9 August, so the
trial grant ran out after roughly three weeks. Nothing was deleted; the boot
disk stayed `READY` and the cluster was stopped rather than dropped.

Two things made this expensive rather than merely annoying:

1. **The Yandex Direct campaign kept spending the whole time**, buying clicks to
   a page that could not load.
2. **The instance's public address was ephemeral**, so stopping it silently
   released `158.160.44.137`. Restarting produced a different address and the
   IONOS A record no longer matched, which is why the site did not simply come
   back when billing was resolved. This has since been fixed by reserving
   `liqvia-ru-app-ip` (`130.193.39.216`) and attaching it, so stop/start no
   longer changes the address.

Nothing outside the host was watching, and anything *on* the host would have
been stopped along with it. Hence an external monitor.

## What is checked

`.github/workflows/landing-uptime.yml` runs `scripts/monitor/check-landing.mjs`
from a GitHub runner roughly every 10 minutes.

| Check | What it proves | Failure means |
|---|---|---|
| `homepage` | `GET /` returns 200 **and** the body contains the hero headline | Site down, or serving the wrong page under a 200 |
| `api-health` | `GET /api/health` returns `status: ok` | The API process is not answering |
| `db-readiness` | `GET /api/health/ready` returns `status: ready` | **The site is up but leads are being lost** — see below |
| `form-endpoint` | `POST /api/cash-os-leads` with `{}` returns `400 "Name is required"` | The lead endpoint is unmounted, broken, or has stopped validating |
| `www-host` | `www.liqvia.info` serves 200 | The CNAME or the host allow-list broke |
| `https-redirect` | `http://` returns a 3xx to `https://` | Non-HTTPS traffic is being dropped |
| `tls-expiry` | Certificate has more than 21 days left | Renewal has silently stopped |
| `russia-vantage` | check-host.net Moscow + St Petersburg nodes get 200 | Advisory only — see below |

### The synthetic form probe

The form check posts an **empty body** on purpose. The endpoint rejects it at the
validation step, before any database write, so the probe exercises DNS, TLS,
Caddy, Express, Nest routing, the controller and its validation — the whole path
a real submission takes up to persistence — while **creating no lead and
notifying nobody**.

A monitor that exercised the happy path instead would write a fake row into the
only commercially meaningful table every ten minutes and send the owner a lead
alert each time, training them to ignore lead alerts. That trade is not worth
making.

`429` is treated as healthy-but-throttled, not as an outage: the endpoint is
demonstrably alive if it is rate limiting us.

### Advisory checks

`russia-vantage` never fails the run. It depends on a third-party service, and
letting someone else's outage raise a Liqvia alarm is how alerts become noise
that gets muted. A genuine RU-side outage still appears in the run log.

### Confirm-before-alerting

A single failed probe is usually a transient blip between the runner and Moscow.
The workflow re-runs the whole check 60 seconds later and only alerts if the
failure survives. Telegram is suppressed on the first attempt so that only the
confirming run can notify.

## The database check — why it is the important one

"App up, database down" is the most expensive failure this system has, and until
10 September 2026 nothing could see it.

It is a state the RU deployment **deliberately allows**: `PrismaService.onModuleInit`
swallows a failed initial connection so the process keeps running, because the
alternative is that Caddy answers a Russian visitor who has just filled in the
form with a bare `502` and the enquiry is lost silently. Staying up lets the lead
endpoint return its own `503` with «попробуйте ещё раз» instead. That is the
right trade for the visitor — but it produces an instance that looks perfectly
healthy from outside while **every lead the campaign pays for is being lost.**

`GET /api/health` cannot see it (it never queries), and the form probe cannot see
it (it stops before persistence). So `GET /api/health/ready` runs `SELECT 1` and
returns `503` when it fails.

Verified 10 September 2026 against a stub in exactly that state: `homepage`,
`api-health` and `form-endpoint` all reported healthy, and `db-readiness` failed
the run with

> `DATABASE UNREACHABLE (HTTP 503) — the site is up but every lead submission is failing and leads are being lost`

**This endpoint is not deployed yet.** It ships ahead of the rebuild, so the
monitor treats `404` as a warning meaning "not deployed", not as an outage. It
starts protecting leads at the next production build (~35 minutes on this
instance).

Note also what happens meanwhile: the loss is bounded rather than invisible. A
visitor whose submission fails sees an actionable Russian error, keeps everything
they typed, and can retry — verified on production on 10 September 2026.

## What this does *not* catch: billing

The monitor detects a billing suspension only *after* it has stopped the
servers — within about ten minutes, rather than nine days, which is the main win.
It cannot give advance warning.

Advance warning is an account-level setting the owner must configure in the
Yandex Cloud console, because this `yc` CLI build has no `billing` command and
the account state is only readable in the web console:

- **Yandex Cloud console → Billing → Budgets** — create a budget alert on the
  billing account with thresholds at, say, 50% / 80% / 100% of the expected
  monthly spend, with email notification.
- Confirm a **payment method** is attached, so exhausting a grant downgrades to
  paid usage instead of triggering a stop.

These are the only defence against a repeat of the root cause, and neither can
be automated from this repository.

## Setup

The workflow runs with no configuration: GitHub emails the repository owner when
a scheduled workflow fails, which is the default alert channel.

For a second channel, add two repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `MONITOR_TELEGRAM_TOKEN` | The bot token, as used by `LEAD_NOTIFY_TELEGRAM_TOKEN` on the server |
| `MONITOR_TELEGRAM_CHAT_ID` | Chat id, or a comma-separated list |

Note that GitHub runners reach `api.telegram.org` normally. The address-pinning
workaround in `LeadNotificationService` exists because *the Yandex host's* egress
is partially filtered; it is not needed here.

## Running it by hand

```bash
node scripts/monitor/check-landing.mjs
```

Exits `0` when everything passes, `1` on any failure. Override the target with
`MONITOR_SITE_URL` — pointing it at a site that is up but is not the landing page
is a good way to confirm the checks actually bite:

```bash
MONITOR_SITE_URL=https://example.com node scripts/monitor/check-landing.mjs
```

## Caveats

- GitHub's `schedule` trigger is best-effort. Runs are delayed or dropped when
  the platform is busy, so this is "roughly every 10 minutes", not a guarantee.
- **Scheduled workflows are disabled automatically after 60 days without
  repository activity.** If commits stop, re-enable this from the Actions tab —
  otherwise the monitor goes quiet in exactly the way it exists to prevent.
- The runner is in Europe or the US. `russia-vantage` is the only check that
  speaks for the audience the campaign actually buys.
