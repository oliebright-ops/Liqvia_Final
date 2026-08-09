/**
 * Proxy trust, which is what makes per-IP rate limiting work at all.
 *
 * The application always runs behind a reverse proxy in production (Caddy on the
 * RU plane, Render's router globally). Without `trust proxy`, Express reports the
 * proxy's own address as `req.ip` for every request, ThrottlerGuard buckets the
 * whole internet together, and the `leads` limit of 5/min becomes five
 * submissions per minute in total — verified against the live RU origin, where
 * six requests carrying six different `X-Forwarded-For` values shared one budget.
 *
 * The setting is equally wrong in the other direction: `true` would trust the
 * entire forwarded chain, letting a caller mint a fresh bucket per request by
 * writing the header itself. Only the single-hop value is correct here, so both
 * failure modes are asserted.
 */
import type { INestApplication } from '@nestjs/common';
import { applySecurityMiddleware } from './apply-security-middleware';

function fakeApp() {
  const settings = new Map<string, unknown>();
  const disabled: string[] = [];

  const express = {
    set: (key: string, value: unknown) => settings.set(key, value),
    get: (key: string) => settings.get(key),
    disable: (key: string) => disabled.push(key),
  };

  const app = {
    getHttpAdapter: () => ({ getInstance: () => express }),
    use: jest.fn(),
  } as unknown as INestApplication;

  return { app, settings, disabled, use: app.use as jest.Mock };
}

describe('applySecurityMiddleware', () => {
  it('trusts exactly one proxy hop', () => {
    const { app, settings } = fakeApp();

    applySecurityMiddleware(app);

    expect(settings.get('trust proxy')).toBe(1);
  });

  it('does not blanket-trust the forwarded chain', () => {
    // `true` would make X-Forwarded-For client-controlled, which turns the rate
    // limiter into a no-op for anyone willing to set a header.
    const { app, settings } = fakeApp();

    applySecurityMiddleware(app);

    expect(settings.get('trust proxy')).not.toBe(true);
    expect(settings.get('trust proxy')).not.toBe('true');
  });

  it('still hides the framework banner and installs helmet', () => {
    const { app, disabled, use } = fakeApp();

    applySecurityMiddleware(app);

    expect(disabled).toContain('x-powered-by');
    expect(use).toHaveBeenCalledTimes(1);
  });
});
