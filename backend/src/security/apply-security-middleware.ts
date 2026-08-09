import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export function applySecurityMiddleware(app: INestApplication): void {
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');

  // Exactly one trusted hop: the reverse proxy in front of us (Caddy on the RU
  // plane, Render's router globally). Without this, Express reports the proxy's
  // own address as `req.ip` for every request, so ThrottlerGuard buckets the
  // entire internet together — the `leads` limit of 5/min becomes 5 submissions
  // per minute *in total*, and one abusive client denies the form to everyone.
  //
  // `1`, never `true`. `true` would trust the whole X-Forwarded-For chain
  // including the part the client wrote, letting an attacker mint a fresh rate
  // limit bucket per request by spoofing the header. Trusting a single hop makes
  // Express take the right-most entry, which is the one the proxy appended
  // itself and a client cannot forge.
  express.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
}
