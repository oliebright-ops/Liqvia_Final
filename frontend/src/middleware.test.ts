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
