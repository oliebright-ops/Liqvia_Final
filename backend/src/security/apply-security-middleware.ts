import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export function applySecurityMiddleware(app: INestApplication): void {
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
}
