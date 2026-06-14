import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizeDatabaseUrl(url: string): string {
  if (url.includes('sslmode=')) return url;
  const needsSsl =
    process.env.NODE_ENV === 'production' ||
    /\.render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(url);
  if (!needsSsl) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}sslmode=require`;
}

function applyDatabaseUrlDefaults(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;
  process.env.DATABASE_URL = normalizeDatabaseUrl(url);
}

function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return;
  console.error(`[env] Missing required production variables: ${missing.join(', ')}`);
  process.exit(1);
}

/** Load env from frontend and backend packages (backend holds DATABASE_URL, JWT, etc.). */
export function loadAppEnv(): void {
  const shellKeys = new Set(Object.keys(process.env));
  const frontendRoot = path.join(__dirname, '..');
  const backendRoot = path.join(frontendRoot, '..', 'backend');
  const repoRoot = path.join(frontendRoot, '..');

  for (const [file, override] of [
    [path.join(repoRoot, '.env'), false],
    [path.join(backendRoot, '.env'), false],
    [path.join(backendRoot, '.env.local'), true],
    [path.join(frontendRoot, '.env'), false],
    [path.join(frontendRoot, '.env.local'), true],
  ] as const) {
    applyEnvFile(file, override, shellKeys);
  }

  applyDatabaseUrlDefaults();
  validateProductionEnv();
}

function applyEnvFile(filePath: string, override: boolean, shellKeys: Set<string>): void {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (shellKeys.has(key)) continue;

    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
