/**
 * Guarded migration runner for the Russian lead data plane.
 *
 * The failure this exists to prevent is not exotic. It is someone — possibly
 * months from now, possibly in a hurry — typing `prisma migrate deploy` in
 * `backend/` with `DATABASE_URL` still pointing at production. That creates all
 * thirty tables of the global application inside Russian infrastructure, returns
 * exit code 0, and looks exactly like success.
 *
 * So the RU plane does not use the generic command. It uses this one, which
 * refuses to run unless four things are simultaneously true:
 *
 *   1. `RU_MIGRATION_DATABASE_URL` is set — the migrator credential, never the
 *      runtime one, and never `DATABASE_URL`;
 *   2. the target host is a *recognised* Russian database host;
 *   3. the target host is not a known non-Russian host;
 *   4. the schema being applied is `prisma/ru/schema.prisma`.
 *
 * An unrecognised host is refused rather than assumed safe. "I don't recognise
 * this" must never resolve to "carry on" where residency is concerned.
 *
 * Usage:  pnpm --filter @liqvia2/backend prisma:ru:deploy
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { databaseHost } from '../src/residency/data-plane';

/** Hosts that are definitively NOT Russian. Checked before the allow-list. */
const NON_RU_HOST_MARKERS = [
  'render.com',
  'oregon-postgres',
  'amazonaws.com',
  'neon.tech',
  'supabase.co',
  'azure.com',
  'googleapis.com',
];

/** Suffixes that identify Yandex Managed PostgreSQL. */
const RU_HOST_SUFFIXES = ['.mdb.yandexcloud.net', '.rw.mdb.yandexcloud.net'];

const RU_SCHEMA = resolve(__dirname, '..', 'prisma', 'ru', 'schema.prisma');

function fail(message: string): never {
  // Loud and unambiguous: this is the last line of defence before the wrong
  // schema reaches the wrong database.
  console.error('\n  RU MIGRATION REFUSED\n');
  console.error(`  ${message}\n`);
  process.exit(1);
}

function main(): void {
  const url = process.env.RU_MIGRATION_DATABASE_URL?.trim();

  if (!url) {
    fail(
      'RU_MIGRATION_DATABASE_URL is not set.\n' +
        '  The RU plane migrates with the migrator credential (ru_migrator), not the\n' +
        '  runtime credential and never DATABASE_URL. Supply it from Lockbox for the\n' +
        '  duration of the deployment step only.',
    );
  }

  const host = databaseHost(url);
  if (!host) {
    fail('RU_MIGRATION_DATABASE_URL is not a parseable PostgreSQL URL.');
  }

  const foreign = NON_RU_HOST_MARKERS.find((marker) => host.includes(marker));
  if (foreign) {
    fail(
      `Target host "${host}" is not Russian infrastructure (matched "${foreign}").\n` +
        '  This is the exact mistake this command exists to prevent: applying a schema\n' +
        '  to the global database, or the global schema to a Russian one.',
    );
  }

  if (!RU_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    fail(
      `Target host "${host}" is not a recognised Russian database host.\n` +
        '  Refusing rather than assuming residency. If this host genuinely is Russian,\n' +
        '  add it to RU_HOST_SUFFIXES deliberately, in a reviewed change.',
    );
  }

  if (!existsSync(RU_SCHEMA)) {
    fail(`RU schema not found at ${RU_SCHEMA}.`);
  }

  console.log(`RU migration target: ${host}`);
  console.log(`RU schema:           ${RU_SCHEMA}\n`);

  // The schema's datasource reads RU_DATABASE_URL. Map the migrator credential
  // onto it for this child process only, so the migrator secret never becomes
  // the runtime's ambient configuration.
  const result = spawnSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', RU_SCHEMA],
    {
      stdio: 'inherit',
      env: { ...process.env, RU_DATABASE_URL: url },
    },
  );

  process.exit(result.status ?? 1);
}

main();
