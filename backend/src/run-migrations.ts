import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Backend package root (contains prisma/schema.prisma). Works from src/ and dist/. */
function backendRoot(): string {
  return resolve(__dirname, '..');
}

function resolvePrismaCli(): string {
  const root = backendRoot();
  const candidates = [
    resolve(root, 'node_modules', 'prisma', 'build', 'index.js'),
    resolve(root, '..', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error('Prisma CLI not found — run pnpm install in the monorepo root.');
}

/**
 * Applies pending SQL migrations via `prisma migrate deploy`.
 * Skipped when SKIP_DB_MIGRATE=true (e.g. certain test harnesses).
 */
export function runMigrations(): void {
  if (process.env.SKIP_DB_MIGRATE === 'true') {
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.warn('[migrate] DATABASE_URL is not set — skipping automatic migration.');
    return;
  }

  const prismaCli = resolvePrismaCli();
  const cwd = backendRoot();

  console.log('[migrate] Applying pending database migrations…');
  execSync(`node "${prismaCli}" migrate deploy`, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[migrate] Database migrations complete.');
}
