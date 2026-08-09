/**
 * The migration guard, tested for the cases that would be catastrophic.
 *
 * The script is exercised as a child process rather than by importing it,
 * because what matters is the observable behaviour of the command someone
 * actually types: does it exit non-zero and refuse, or does it proceed?
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT = resolve(__dirname, '..', '..', 'scripts', 'ru-migrate.ts');

const RU_URL = 'postgresql://ru_migrator:x@rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net:6432/liqvia_ru';
const GLOBAL_URL = 'postgresql://u:p@dpg-d8ncrgi8qa3s73f08st0-a.oregon-postgres.render.com/liqviadb';

function run(env: Record<string, string | undefined>) {
  const result = spawnSync(
    'npx',
    ['ts-node', '--transpile-only', '--compiler-options', '{"module":"commonjs"}', SCRIPT],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        RU_MIGRATION_DATABASE_URL: undefined,
        ...env,
        // Never let a real deploy fire from a test.
        PRISMA_SKIP: '1',
      },
      timeout: 60_000,
    },
  );
  return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

describe('RU migration guard', () => {
  it('refuses when RU_MIGRATION_DATABASE_URL is absent', () => {
    const { status, out } = run({});
    expect(status).not.toBe(0);
    expect(out).toContain('RU MIGRATION REFUSED');
    expect(out).toContain('RU_MIGRATION_DATABASE_URL is not set');
  });

  it('REFUSES the real global Oregon host', () => {
    // The case that would create 30 global tables in Russian infrastructure,
    // or apply the RU schema to the production database.
    const { status, out } = run({ RU_MIGRATION_DATABASE_URL: GLOBAL_URL });
    expect(status).not.toBe(0);
    expect(out).toContain('RU MIGRATION REFUSED');
    expect(out).toContain('not Russian infrastructure');
  });

  it('refuses an unrecognised host rather than assuming residency', () => {
    const { status, out } = run({
      RU_MIGRATION_DATABASE_URL: 'postgresql://u:p@db.example.net:5432/x',
    });
    expect(status).not.toBe(0);
    expect(out).toContain('not a recognised Russian database host');
  });

  it('refuses an unparseable URL', () => {
    const { status, out } = run({ RU_MIGRATION_DATABASE_URL: 'not-a-url' });
    expect(status).not.toBe(0);
    expect(out).toContain('RU MIGRATION REFUSED');
  });

  it('accepts the real Yandex host and reaches the prisma step', () => {
    // Credentials are fake, so prisma itself will fail to connect — but the
    // guard must have passed, which is what this asserts. Reaching prisma at all
    // proves host validation succeeded.
    const { out } = run({ RU_MIGRATION_DATABASE_URL: RU_URL });
    expect(out).not.toContain('RU MIGRATION REFUSED');
    expect(out).toContain('rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net');
    expect(out).toContain('prisma/ru/schema.prisma');
  });
});
