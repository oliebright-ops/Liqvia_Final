import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const YANDEX_METRICA_ORIGINS = [
  'https://mc.yandex.ru',
  'https://mc.yandex.com',
  'https://mc.yandex.az',
  'https://mc.yandex.by',
  'https://mc.yandex.co.il',
  'https://mc.yandex.com.am',
  'https://mc.yandex.com.ge',
  'https://mc.yandex.com.tr',
  'https://mc.yandex.ee',
  'https://mc.yandex.fr',
  'https://mc.yandex.kg',
  'https://mc.yandex.kz',
  'https://mc.yandex.lt',
  'https://mc.yandex.lv',
  'https://mc.yandex.md',
  'https://mc.yandex.tj',
  'https://mc.yandex.tm',
  'https://mc.yandex.uz',
].join(' ');

function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `img-src 'self' data: blob: ${YANDEX_METRICA_ORIGINS}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' ${YANDEX_METRICA_ORIGINS} https://yastatic.net`,
    `connect-src 'self' ${YANDEX_METRICA_ORIGINS}`,
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
  // Public legal documents. Both are linked from the landing footer and from
  // the required consent checkbox, so they must resolve on the marketing hosts —
  // a consent that references a document the user cannot open is not a consent.
  '/privacy',
  '/consent',
  '/_next/',
  '/favicon.ico',
  // Search-engine plumbing. Without these three the catch-all below answers a
  // crawler with a 307 to `/` and then an HTML page, which is not a valid reply
  // to any of them.
  //
  // `/yandex_*.html` is the site-ownership proof Yandex Webmaster asks you to
  // upload before Direct will run against the domain: it fetches that exact
  // path and expects the file, so a redirect fails verification. Allowing the
  // prefix only makes it *reachable* — the file itself still has to be placed in
  // `frontend/public/` from the Webmaster console, and until it is, this path
  // correctly 404s.
  '/yandex_',
  '/robots.txt',
  '/sitemap.xml',
];

/**
 * Paths that are never legitimate on a public marketing origin: dotfiles and VCS
 * metadata, dependency manifests, dumps and archives, and the usual PHP/WordPress
 * probe set. Automated scanning for these began within minutes of the origin
 * becoming publicly reachable.
 *
 * Nothing here is actually served by this application — Next.js has no route for
 * them and the files are not in the web root — so this is defence in depth rather
 * than a plugged leak. What it changes is the *answer*: a redirect to `/` returns
 * `307` plus a `Location`, which tells a scanner the origin is live, handling the
 * path, and worth further probing. `404` tells it nothing.
 *
 * Deliberately not a catch-all: ordinary unknown paths keep the friendly redirect
 * to the landing page, because a person who mistypes a URL is not a scanner.
 */
const SENSITIVE_PATH_PATTERN =
  /(^|\/)(\.env($|\.)|\.git($|\/)|\.svn($|\/)|\.hg($|\/)|\.aws($|\/)|\.ssh($|\/)|\.DS_Store$|\.htaccess$|\.htpasswd$|\.npmrc$|\.dockerignore$|id_rsa|id_ed25519)|\.(sql|sqlite|sqlite3|db|dump|bak|backup|old|orig|swp|pem|key|p12|pfx|keystore|log|map)$|^\/(wp-admin|wp-content|wp-includes|wp-login\.php|wp-config\.php|xmlrpc\.php|phpinfo\.php|phpmyadmin|server-status|server-info|actuator|\.well-known\/security\.txt\.bak)($|\/)|^\/(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|composer\.(json|lock)|Dockerfile|docker-compose\.ya?ml|Gemfile|requirements\.txt|prisma\/schema\.prisma)$/i;

function isSensitivePath(pathname: string): boolean {
  let decoded = pathname;
  try {
    // A scanner may percent-encode to slip past a naive string match
    // (`/%2e%65nv`). Match on the decoded form as well as the raw one.
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed percent-encoding: treat the raw path as hostile in its own right.
    return true;
  }

  return (
    SENSITIVE_PATH_PATTERN.test(pathname) || SENSITIVE_PATH_PATTERN.test(decoded)
  );
}

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

  /**
   * Before any host routing: sensitive paths get a flat 404 on every host, and
   * never a redirect. Placed first so the answer cannot depend on the Host header.
   */
  if (isSensitivePath(pathname)) {
    return applySecurityHeaders(
      new NextResponse(null, { status: 404 })
    );
  }

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
