import './load-env';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { runMigrations } from './run-migrations';
import { runDemoSeedOnStartup } from './demo/demo-seed.runner';
import { applySecurityMiddleware } from './security/apply-security-middleware';
import { setupSwagger } from './setup-swagger';

export interface NestAppOptions {
  /** When true, init without listening (embedded in Next unified server). */
  embedded?: boolean;
  /** Run prisma migrate deploy before boot (default: true). */
  migrate?: boolean;
  /** Enable Swagger at /api/docs (default: true when not embedded). */
  swagger?: boolean;
}

/**
 * Create the NestJS application. Used by the standalone backend and the unified Next server.
 */
export async function createNestApplication(
  options: NestAppOptions = {},
): Promise<INestApplication> {
  const embedded = options.embedded ?? false;
  const migrate = options.migrate ?? true;
  const swagger = options.swagger ?? !embedded;

  if (migrate) {
    runMigrations();
  }

  const app = await NestFactory.create(AppModule, {
    logger: embedded ? ['error', 'warn'] : undefined,
  });

  applySecurityMiddleware(app);

  if (migrate) {
    await runDemoSeedOnStartup(app);
  }

  if (!embedded) {
    const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    app.enableCors({ origin: corsOrigin });
  }

  app.setGlobalPrefix('api');

  if (swagger) {
    setupSwagger(app);
  }

  if (embedded) {
    await app.init();
  }

  return app;
}

/** Express instance backing the Nest HTTP adapter (after init). */
export function getNestExpress(app: INestApplication): Express {
  return app.getHttpAdapter().getInstance() as Express;
}
