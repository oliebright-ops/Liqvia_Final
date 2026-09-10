#!/usr/bin/env node
/**
 * External availability check for the RU campaign landing page.
 *
 * ## Why this exists
 *
 * Between 1 and 10 September 2026 `liqvia.info` was down and nobody noticed for
 * nine days. The cause was not a bug: Yandex's automated billing actor
 * (`yc.iam.reaper`) stopped both the compute instance and the Postgres cluster
 * when the billing account was suspended. The Yandex Direct campaign kept
 * spending against a dead landing page for the whole period.
 *
 * The lesson is not "watch the app harder". It is that nothing outside the host
 * was watching at all, so any whole-host failure — billing, quota, a bad deploy,
 * a released IP address — was invisible. This check therefore runs from GitHub's
 * infrastructure rather than from the server it is checking.
 *
 * ## What it deliberately does NOT do
 *
 * It never submits a lead. A monitor that exercises the happy path would write a
 * fake row into the leads table every few minutes and notify the owner each time,
 * which would both pollute the only table that matters commercially and train the
 * owner to ignore lead alerts. See `formEndpointCheck` for the synthetic probe
 * used instead.
 */

const SITE = process.env.MONITOR_SITE_URL ?? 'https://liqvia.info';
const TIMEOUT_MS = Number(process.env.MONITOR_TIMEOUT_MS ?? 30_000);

/**
 * A string that only the real landing page contains.
 *
 * Checking for HTTP 200 alone is not enough: a misrouted deploy, a stray reverse
 * proxy default page, or the authenticated app rendered on the marketing host
 * would all answer 200 while showing the visitor something that cannot convert.
 * This is the hero headline, which is the page's whole proposition — if it is
 * gone, the page is wrong regardless of status code.
 */
const LANDING_CONTENT_MARKER = 'Прибыль есть';

/** Warn while there is still time to act, rather than at the moment of expiry. */
const TLS_WARN_DAYS = 21;

/** Collected results; one object per check. */
const results = [];

function record(name, ok, detail, { warning = false } = {}) {
  results.push({ name, ok, detail, warning });
  const mark = ok ? (warning ? 'WARN' : 'ok  ') : 'FAIL';
  console.log(`[${mark}] ${name} — ${detail}`);
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: init.redirect ?? 'follow',
    });
    return { response, ms: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

/** The homepage renders, and renders the landing page specifically. */
async function homepageCheck() {
  try {
    const { response, ms } = await fetchWithTimeout(`${SITE}/`);
    if (!response.ok) {
      return record('homepage', false, `HTTP ${response.status} after ${ms}ms`);
    }
    const body = await response.text();
    if (!body.includes(LANDING_CONTENT_MARKER)) {
      return record(
        'homepage',
        false,
        `HTTP 200 in ${ms}ms but the page does not contain ` +
          `"${LANDING_CONTENT_MARKER}" — wrong page is being served`,
      );
    }
    record('homepage', true, `HTTP 200 in ${ms}ms, landing content present`);
  } catch (err) {
    record('homepage', false, `unreachable: ${describe(err)}`);
  }
}

/**
 * The lead endpoint is alive and still validating.
 *
 * Posting an empty body is the whole trick. The endpoint rejects it at the
 * validation step, *before* any database write, so this exercises DNS, TLS,
 * Caddy, Express, Nest routing, the controller and its validation — the entire
 * path a real submission takes up to the point of persistence — while creating
 * nothing and notifying nobody.
 *
 * A 400 with the expected message is therefore the healthy result, and anything
 * else is the alarm: 404 or 502 means the API is not mounted, 5xx means the app
 * is broken, and a 200 would mean validation has stopped working and the form is
 * accepting empty submissions.
 *
 * Note what this cannot see: because it stops short of the database, it stays
 * green when Postgres is down, which is exactly when real submissions fail with
 * 503 and leads are lost. Closing that blind spot needs a readiness endpoint
 * that pings the database; see docs/RU_UPTIME_MONITORING.md.
 */
async function formEndpointCheck() {
  try {
    const { response, ms } = await fetchWithTimeout(`${SITE}/api/cash-os-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (response.status === 429) {
      // Not a fault: the endpoint is demonstrably alive, it is just rate limiting
      // us. Treating this as an outage would page the owner over a working site.
      return record('form-endpoint', true, `HTTP 429 in ${ms}ms — alive, throttled`, {
        warning: true,
      });
    }
    if (response.status !== 400) {
      return record(
        'form-endpoint',
        false,
        `expected HTTP 400 from an empty submission, got ${response.status} after ${ms}ms`,
      );
    }
    const body = await response.json().catch(() => ({}));
    if (typeof body.message !== 'string' || !body.message) {
      return record('form-endpoint', false, 'HTTP 400 but no validation message — unexpected shape');
    }
    record('form-endpoint', true, `HTTP 400 "${body.message}" in ${ms}ms — validating normally`);
  } catch (err) {
    record('form-endpoint', false, `unreachable: ${describe(err)}`);
  }
}

/** The API process itself answers. */
async function apiHealthCheck() {
  try {
    const { response, ms } = await fetchWithTimeout(`${SITE}/api/health`);
    if (!response.ok) {
      return record('api-health', false, `HTTP ${response.status} after ${ms}ms`);
    }
    const body = await response.json().catch(() => ({}));
    if (body.status !== 'ok') {
      return record('api-health', false, `unexpected body: ${JSON.stringify(body).slice(0, 120)}`);
    }
    record('api-health', true, `status ok in ${ms}ms`);
  } catch (err) {
    record('api-health', false, `unreachable: ${describe(err)}`);
  }
}

/**
 * The instance can actually store a lead — i.e. the database is reachable.
 *
 * This is the check that closes the blind spot the other probes leave. The form
 * probe stops before persistence and `/api/health` never touches Postgres, so
 * without this the monitor stays green in the one state where the site looks
 * perfectly healthy and every submission fails with 503.
 *
 * A 404 is reported as a warning rather than a failure because the endpoint ships
 * ahead of the deploy that exposes it: until the RU host is rebuilt, "not found"
 * means "not deployed yet", not "outage". Once `/api/health/ready` is live this
 * arm stops being reachable, and a genuine 404 would then mean the API lost a
 * route — which the `form-endpoint` and `api-health` checks would already be
 * failing on.
 */
async function readinessCheck() {
  try {
    const { response, ms } = await fetchWithTimeout(`${SITE}/api/health/ready`);

    if (response.status === 404) {
      return record('db-readiness', true, 'endpoint not deployed yet (HTTP 404)', {
        warning: true,
      });
    }
    if (response.status === 503) {
      return record(
        'db-readiness',
        false,
        `DATABASE UNREACHABLE (HTTP 503 after ${ms}ms) — the site is up but ` +
          'every lead submission is failing and leads are being lost',
      );
    }
    if (!response.ok) {
      return record('db-readiness', false, `unexpected HTTP ${response.status} after ${ms}ms`);
    }

    const body = await response.json().catch(() => ({}));
    if (body.status !== 'ready') {
      return record('db-readiness', false, `unexpected body: ${JSON.stringify(body).slice(0, 120)}`);
    }
    record('db-readiness', true, `database reachable (${body.latencyMs ?? '?'}ms query) in ${ms}ms`);
  } catch (err) {
    record('db-readiness', false, `unreachable: ${describe(err)}`);
  }
}

/**
 * `www` resolves and serves too.
 *
 * It is a CNAME to the apex and is listed in the middleware's landing hosts, so
 * an advert or a backlink may legitimately use it. A visitor who lands on a
 * broken `www` is lost just as completely as one who lands on a broken apex.
 */
async function wwwCheck() {
  const url = SITE.replace('://', '://www.');
  try {
    const { response, ms } = await fetchWithTimeout(`${url}/`);
    if (!response.ok) return record('www-host', false, `HTTP ${response.status} after ${ms}ms`);
    record('www-host', true, `HTTP 200 in ${ms}ms`);
  } catch (err) {
    record('www-host', false, `unreachable: ${describe(err)}`);
  }
}

/**
 * Plain HTTP still redirects to HTTPS.
 *
 * Yandex Direct final URLs are https, but organic links, typed addresses and old
 * backlinks are not. If the redirect breaks, that traffic silently disappears.
 */
async function httpsRedirectCheck() {
  const url = SITE.replace('https://', 'http://');
  try {
    const { response, ms } = await fetchWithTimeout(`${url}/`, { redirect: 'manual' });
    const location = response.headers.get('location') ?? '';
    if (response.status < 300 || response.status >= 400) {
      return record('https-redirect', false, `expected a 3xx redirect, got ${response.status}`);
    }
    if (!location.startsWith('https://')) {
      return record('https-redirect', false, `redirects to "${location}", which is not https`);
    }
    record('https-redirect', true, `HTTP ${response.status} → ${location} in ${ms}ms`);
  } catch (err) {
    record('https-redirect', false, `unreachable: ${describe(err)}`);
  }
}

/**
 * Reachability from inside Russia, which is the only network that commercially
 * matters here and the one this runner cannot speak for.
 *
 * A GitHub runner sits in Europe or the US. It can be perfectly happy while the
 * site is unreachable for the audience the campaign is buying, so this delegates
 * to check-host.net's Moscow and St Petersburg nodes.
 *
 * Treated as advisory, never as a hard failure: it depends on a third-party
 * service, and letting someone else's outage raise a Liqvia alarm is how alerts
 * become noise that gets muted. A genuine RU-side outage still shows up in the
 * run log and in the summary.
 */
async function russianVantageCheck() {
  const nodes = ['ru1.node.check-host.net', 'ru2.node.check-host.net', 'ru3.node.check-host.net'];
  const query = nodes.map((n) => `node=${n}`).join('&');
  try {
    const { response } = await fetchWithTimeout(
      `https://check-host.net/check-http?host=${encodeURIComponent(`${SITE}/`)}&${query}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      return record('russia-vantage', true, `check-host unavailable (HTTP ${response.status})`, {
        warning: true,
      });
    }
    const { request_id: requestId } = await response.json();
    if (!requestId) {
      return record('russia-vantage', true, 'check-host returned no request id', { warning: true });
    }

    // The nodes report asynchronously; poll rather than guess a fixed wait.
    let report = {};
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 3_000));
      const { response: poll } = await fetchWithTimeout(
        `https://check-host.net/check-result/${requestId}`,
        { headers: { Accept: 'application/json' } },
      );
      report = await poll.json().catch(() => ({}));
      // A node that has not answered yet is `null`; wait for all of them.
      if (Object.keys(report).length && Object.values(report).every((v) => v !== null)) break;
    }

    const answered = Object.entries(report).filter(([, v]) => v !== null);
    if (!answered.length) {
      return record('russia-vantage', true, 'no Russian node reported in time', { warning: true });
    }

    const failures = answered.filter(([, v]) => {
      const first = Array.isArray(v) ? v[0] : null;
      return !Array.isArray(first) || first[0] !== 1;
    });

    const summary = answered
      .map(([node, v]) => {
        const first = Array.isArray(v) ? v[0] : null;
        const city = node.split('.')[0];
        if (!Array.isArray(first)) return `${city}: no data`;
        return first[0] === 1 ? `${city}: ${first[3]} in ${first[1].toFixed(2)}s` : `${city}: ${first[2]}`;
      })
      .join(', ');

    if (failures.length === answered.length) {
      return record('russia-vantage', true, `ALL Russian nodes failed — ${summary}`, {
        warning: true,
      });
    }
    record('russia-vantage', true, summary, { warning: failures.length > 0 });
  } catch (err) {
    record('russia-vantage', true, `check skipped: ${describe(err)}`, { warning: true });
  }
}

/**
 * The TLS certificate is not about to expire.
 *
 * Caddy renews automatically and its storage is a persisted volume, so this
 * should never fire — but "should never fire" is precisely the assumption that
 * an expiry check exists to test. An expired certificate on a paid landing page
 * is a total conversion outage behind a browser interstitial.
 */
async function tlsExpiryCheck() {
  const host = new URL(SITE).hostname;
  const tls = await import('node:tls');
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: TIMEOUT_MS },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          record('tls-expiry', true, 'no certificate detail available', { warning: true });
          return resolve();
        }
        const days = Math.floor((new Date(cert.valid_to) - Date.now()) / 86_400_000);
        if (days < 0) record('tls-expiry', false, `certificate EXPIRED ${-days} days ago`);
        else if (days <= TLS_WARN_DAYS)
          record('tls-expiry', true, `expires in ${days} days`, { warning: true });
        else record('tls-expiry', true, `valid for ${days} more days`);
        resolve();
      },
    );
    socket.on('timeout', () => {
      socket.destroy();
      record('tls-expiry', false, 'TLS handshake timed out');
      resolve();
    });
    socket.on('error', (err) => {
      record('tls-expiry', false, `TLS error: ${describe(err)}`);
      resolve();
    });
  });
}

function describe(err) {
  if (err && err.name === 'AbortError') return `timed out after ${TIMEOUT_MS}ms`;
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/**
 * Sends the alert to Telegram when the repository is configured for it.
 *
 * Optional by design. GitHub already emails the owner when a scheduled workflow
 * fails, so this is a second channel rather than the only one — and the workflow
 * must still work in a fork or a clone that has no secrets.
 */
async function notifyTelegram(text) {
  const token = process.env.MONITOR_TELEGRAM_TOKEN?.trim();
  const chatIds = (process.env.MONITOR_TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || !chatIds.length) return;

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        });
      } catch (err) {
        // Never let the notifier decide the exit code — the check result stands
        // on its own, and a Telegram outage is not a Liqvia outage.
        console.error(`Telegram notification failed: ${describe(err)}`);
      }
    }),
  );
}

async function main() {
  console.log(`Checking ${SITE} at ${new Date().toISOString()}\n`);

  // Sequential on purpose: a handful of requests a few minutes apart should not
  // arrive as a burst against a single small instance, and the leads endpoint is
  // rate limited.
  await homepageCheck();
  await apiHealthCheck();
  await readinessCheck();
  await formEndpointCheck();
  await wwwCheck();
  await httpsRedirectCheck();
  await tlsExpiryCheck();
  await russianVantageCheck();

  const failures = results.filter((r) => !r.ok);
  const warnings = results.filter((r) => r.ok && r.warning);

  console.log('');
  if (failures.length) {
    const text =
      `🔴 Liqvia landing check FAILED (${failures.length}/${results.length})\n` +
      `${SITE}\n\n` +
      failures.map((f) => `• ${f.name}: ${f.detail}`).join('\n');
    console.error(text);
    await notifyTelegram(text);
    process.exitCode = 1;
    return;
  }

  console.log(
    `All ${results.length} checks passed` +
      (warnings.length ? ` (${warnings.length} warning(s))` : '') +
      '.',
  );
}

main().catch(async (err) => {
  // An unexpected throw is itself an alertable condition: it means the monitor
  // stopped monitoring, which is how the September outage stayed invisible.
  console.error(`Monitor crashed: ${describe(err)}`);
  await notifyTelegram(`🔴 Liqvia landing monitor crashed: ${describe(err)}`);
  process.exitCode = 1;
});
