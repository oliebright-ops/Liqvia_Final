import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Backend package root (parent of src/ or dist/). */
const backendRoot = resolve(__dirname, '..');

function applyEnvFile(path: string, override: boolean): void {
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
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

for (const [file, override] of [
  ['.env', false],
  ['.env.local', true],
] as const) {
  const path = resolve(backendRoot, file);
  if (existsSync(path)) {
    applyEnvFile(path, override);
  }
}
