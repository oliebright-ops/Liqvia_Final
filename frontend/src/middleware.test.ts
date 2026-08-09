/**
 * Domain-routing regression tests for the landing hosts.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * Pure edge-middleware tests: no database, no network, no environment file is
 * read. `NextRequest`/`NextResponse` are constructed in-process.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

type HostHeader = 'host' | 'x-forwarded-host';

function request(path: string, headerName: HostHeader, host: string): NextRequest {
  // The URL authority is deliberately unrelated to the header under test, so a
  // passing case proves the header itself drove the decision.
  return new NextRequest(`https://internal.invalid${path}`, {
    headers: { [headerName]: host },
  });
}

const LANDING_HOSTS = ['liqvia.info', 'www.liqvia.info', 'liqvia-landing.onrender.com'];
const HOST_HEADERS: HostHeader[] = ['host', 'x-forwarded-host'];

for (const headerName of HOST_HEADERS) {
  for (const host of LANDING_HOSTS) {
    test(`/privacy is served (not redirected) on ${host} via ${headerName}`, () => {
      const response = middleware(request('/privacy', headerName, host));

      assert.equal(response.status, 200, 'expected a pass-through, not a 307 redirect');
      assert.equal(response.headers.get('location'), null);
      assert.equal(response.headers.get('x-middleware-rewrite'), null);
    });
  }

  test(`/privacy keeps campaign parameters on ${headerName}`, () => {
    const response = middleware(
      request('/privacy?yclid=1234567890&utm_source=yandex', headerName, 'liqvia.info'),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  });

  test(`landing root still rewrites to the landing page on ${headerName}`, () => {
    const response = middleware(request('/', headerName, 'liqvia.info'));

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('x-middleware-rewrite') ?? '',
      /\/cash-operating-system$/,
    );
  });

  test(`application routes are still redirected away from the landing host on ${headerName}`, () => {
    for (const path of ['/login', '/register', '/onboarding', '/treasury']) {
      const response = middleware(request(path, headerName, 'liqvia.info'));

      assert.equal(response.status, 307, `${path} should not be public`);
      assert.match(response.headers.get('location') ?? '', /\/$/);
    }
  });
}

/**
 * The required consent checkbox links to both documents. If either 307s away on
 * the collecting host, the user is asked to agree to something they cannot read.
 */
for (const headerName of HOST_HEADERS) {
  for (const host of LANDING_HOSTS) {
    test(`/consent is served (not redirected) on ${host} via ${headerName}`, () => {
      const response = middleware(request('/consent', headerName, host));

      assert.equal(response.status, 200, 'expected a pass-through, not a 307 redirect');
      assert.equal(response.headers.get('location'), null);
      assert.equal(response.headers.get('x-middleware-rewrite'), null);
    });
  }
}

test('/consent keeps campaign parameters', () => {
  const response = middleware(
    request('/consent?yclid=1234567890&utm_source=yandex', 'host', 'liqvia.info'),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});

test('/consent is untouched on the application host', () => {
  const response = middleware(request('/consent', 'host', 'app.liqvia.com'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
});

test('lead submission and landing assets remain allowed on the landing host', () => {
  for (const path of [
    '/cash-operating-system',
    '/cash-os/thanks',
    '/api/cash-os-leads',
    '/_next/static/chunk.js',
  ]) {
    const response = middleware(request(path, 'host', 'liqvia.info'));

    assert.equal(response.status, 200, `${path} should pass through`);
    assert.equal(response.headers.get('location'), null, `${path} should not redirect`);
  }
});

test('the port suffix on the host header does not defeat landing detection', () => {
  const response = middleware(request('/privacy', 'host', 'liqvia.info:443'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});

test('x-forwarded-host lists use the first entry', () => {
  const response = middleware(request('/privacy', 'x-forwarded-host', 'liqvia.info, proxy.internal'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});

test('/privacy is untouched on the application host', () => {
  const response = middleware(request('/privacy', 'host', 'app.liqvia.com'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
});

test('application routes are untouched on the application host', () => {
  for (const path of ['/login', '/register', '/treasury']) {
    const response = middleware(request(path, 'host', 'app.liqvia.com'));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  }
});

test('security headers are applied to the privacy response', () => {
  const response = middleware(request('/privacy', 'host', 'liqvia.info'));

  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Security-Policy') ?? '', /default-src 'self'/);
});

/**
 * Sensitive-path handling.
 *
 * Automated scanning for these paths began within minutes of the RU origin
 * becoming publicly reachable. None of them is served by this application, so
 * what is asserted here is the *answer*: a flat 404 carrying no `Location`,
 * on every host, so the response cannot be used to fingerprint the origin.
 */
const SENSITIVE_PATHS = [
  '/.env',
  '/.env.production',
  '/.git/config',
  '/.git/HEAD',
  '/.aws/credentials',
  '/.ssh/id_rsa',
  '/.DS_Store',
  '/.npmrc',
  '/backup.sql',
  '/dump.sqlite',
  '/database.bak',
  '/private.pem',
  '/app.log',
  '/main.js.map',
  '/wp-config.php',
  '/wp-login.php',
  '/xmlrpc.php',
  '/phpinfo.php',
  '/server-status',
  '/actuator',
  '/package.json',
  '/pnpm-lock.yaml',
  '/Dockerfile',
  '/docker-compose.yml',
  '/prisma/schema.prisma',
];

for (const path of SENSITIVE_PATHS) {
  test(`${path} returns 404 on the landing host and never redirects`, () => {
    const response = middleware(request(path, 'host', 'liqvia.info'));

    assert.equal(response.status, 404, `${path} should be a flat 404`);
    assert.equal(response.headers.get('location'), null, `${path} must not redirect`);
    assert.equal(response.headers.get('x-middleware-rewrite'), null);
  });

  test(`${path} returns 404 on the application host too`, () => {
    // The decision must not depend on the Host header: the origin is reachable
    // by IP, so an unrecognised host must not become a softer code path.
    const response = middleware(request(path, 'host', 'app.liqvia.com'));

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
  });
}

test('percent-encoded sensitive paths are also refused', () => {
  for (const path of ['/%2e%65nv', '/%2Egit/config', '/.env%2Eproduction']) {
    const response = middleware(request(path, 'host', 'liqvia.info'));

    assert.equal(response.status, 404, `${path} should not slip past the matcher`);
    assert.equal(response.headers.get('location'), null);
  }
});

test('sensitive-path 404s still carry the security headers', () => {
  const response = middleware(request('/.env', 'host', 'liqvia.info'));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('legitimate paths that merely resemble sensitive ones are unaffected', () => {
  // Guards against the matcher being too greedy: these must keep working, or the
  // fix has broken the site it was meant to protect.
  const stillFine: Array<[string, number]> = [
    ['/privacy', 200],
    ['/consent', 200],
    ['/cash-os/logo.svg', 200],
    ['/_next/static/chunks/main.js', 200],
    ['/favicon.ico', 200],
    ['/api/cash-os-leads', 200],
  ];

  for (const [path, expected] of stillFine) {
    const response = middleware(request(path, 'host', 'liqvia.info'));
    assert.equal(response.status, expected, `${path} must not be caught by the sensitive matcher`);
  }
});

test('an ordinary mistyped URL still gets the friendly redirect, not a 404', () => {
  const response = middleware(request('/pricingg', 'host', 'liqvia.info'));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://internal.invalid/');
});

/**
 * Search-engine plumbing.
 *
 * Yandex Webmaster verifies domain ownership by fetching `/yandex_<hash>.html`
 * and expecting the file. The catch-all redirect answered that with a 307 to `/`
 * followed by an HTML page, which fails verification — and Direct will not run
 * against an unverified domain.
 */
test('the Yandex ownership-proof path is not redirected away', () => {
  for (const path of ['/yandex_1234567890abcdef.html', '/yandex_deadbeef.html']) {
    const response = middleware(request(path, 'host', 'liqvia.info'));

    // 200 here is the middleware passing it through to Next; whether a file is
    // actually present is a separate question, and a 404 from Next is a correct
    // answer until one is uploaded. What must never happen is a redirect.
    assert.equal(response.status, 200, `${path} must reach the static handler`);
    assert.equal(response.headers.get('location'), null);
  }
});

test('robots.txt and sitemap.xml are not redirected to HTML', () => {
  for (const path of ['/robots.txt', '/sitemap.xml']) {
    const response = middleware(request(path, 'host', 'liqvia.info'));

    assert.equal(response.status, 200, `${path} must not become a 307 to /`);
    assert.equal(response.headers.get('location'), null);
  }
});

test('the yandex_ prefix does not become a general bypass', () => {
  // Allowing the prefix must not create a hole: a sensitive path that merely
  // starts with it is still refused, because the sensitive check runs first.
  const response = middleware(request('/yandex_/../.env', 'host', 'liqvia.info'));

  assert.equal(response.status, 404);
});
