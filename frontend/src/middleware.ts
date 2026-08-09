import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https://mc.yandex.ru",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net",
    "connect-src 'self' https://mc.yandex.ru",
    "child-src blob: https://mc.yandex.ru",
    "frame-src blob: https://mc.yandex.ru",
  ].join('; ');
}

/**
 * Public marketing hosts for the Cash Operating System landing page.
 *
 * These hosts must expose only the marketing experience.
 * The authenticated Liqvia application remains available through
 * its existing application domain(s).
 */
const LANDING_ONLY_HOSTS = new Set([
  'liqvia.info',
  'www.liqvia.info',
  'liqvia-landing.onrender.com',
]);

const LANDING_PATH = '/cash-operating-system';

const LANDING_ALLOWED_PREFIXES = [
  LANDING_PATH,
  '/cash-os/',
  '/api/cash-os-leads',
  '/_next/',
  '/favicon.ico',
];

function getRequestHost(request: NextRequest): string {
  // Prefer the forwarded host when Render/reverse proxies provide it.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || '';

  // x-forwarded-host can technically contain a comma-separated list.
  return host
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
}

function isLandingHost(request: NextRequest): boolean {
  return LANDING_ONLY_HOSTS.has(getRequestHost(request));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLandingHost(request)) {
    /**
     * The public root URL:
     *
     * https://liqvia.info/
     *
     * internally renders:
     *
     * /cash-operating-system
     *
     * while keeping the clean root URL visible in the browser.
     */
    if (pathname === '/') {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = LANDING_PATH;

      return applySecurityHeaders(
        NextResponse.rewrite(rewriteUrl)
      );
    }

    /**
     * Allow resources/routes required by the landing experience.
     */
    const isAllowed = LANDING_ALLOWED_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (isAllowed) {
      return applySecurityHeaders(NextResponse.next());
    }

    /**
     * Prevent authenticated Liqvia product routes such as:
     *
     * /login
     * /register
     * /dashboard
     * /settings
     *
     * from being exposed through the marketing domain.
     *
     * Send visitors back to the clean marketing root rather than
     * exposing /cash-operating-system in the public URL.
     */
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = '/';
    landingUrl.search = '';

    return applySecurityHeaders(
      NextResponse.redirect(landingUrl)
    );
  }

  /**
   * All non-marketing hosts continue using the normal Liqvia app.
   */
  return applySecurityHeaders(NextResponse.next());
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set(
    'Content-Security-Policy',
    buildContentSecurityPolicy()
  );

  if (isProd) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
