import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
  ].join('; ');
}

// liqvia.info is the public marketing domain for the Cash Operating System landing page —
// intentionally kept separate from the authenticated Liqvia product (login/register/dashboard),
// which stays reachable only through the app's own domain(s). This is not a security boundary
// (both live in the same deployed service) — it's a UX/positioning boundary so the marketing
// funnel never accidentally surfaces or links into the product.
const LANDING_ONLY_HOSTS = new Set(['liqvia.info', 'www.liqvia.info']);
const LANDING_PATH = '/cash-operating-system';
const LANDING_ALLOWED_PREFIXES = [LANDING_PATH, '/cash-os/', '/api/cash-os-leads', '/_next/', '/favicon.ico'];

function isLandingHost(host: string | null): boolean {
  if (!host) return false;
  return LANDING_ONLY_HOSTS.has(host.split(':')[0].toLowerCase());
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const { pathname } = request.nextUrl;

  if (isLandingHost(host)) {
    const isAllowed = LANDING_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!isAllowed) {
      if (pathname === '/') {
        return applySecurityHeaders(NextResponse.rewrite(new URL(LANDING_PATH, request.url)));
      }
      return applySecurityHeaders(NextResponse.redirect(new URL(LANDING_PATH, request.url)));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());

  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
