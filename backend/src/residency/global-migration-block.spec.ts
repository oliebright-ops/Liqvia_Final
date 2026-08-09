/**
 * The global schema must never be deployed to the Russian database.
 *
 * This is the highest-consequence failure available in this architecture: the app
 * runs `prisma migrate deploy` on startup, so an RU deployment pointed at the RU
 * database would create all thirty global tables inside Russian infrastructure —
 * on boot, silently, while reporting a healthy start.
 */
import { runMigrations } from '../run-migrations';

describe('startup migrations on the RU data plane', () => {
  const saved = { ...process.env };
  let logs: string[] = [];
  let spy: jest.SpyInstance;

  beforeEach(() => {
    logs = [];
    spy = jest.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      logs.push(a.map(String).join(' '));
    });
  });
  afterEach(() => {
    spy.mockRestore();
    process.env = { ...saved };
  });

  it('REFUSES to apply the global schema when LIQVIA_DATA_PLANE=ru', () => {
    process.env.LIQVIA_DATA_PLANE = 'ru';
    // A real RU database URL. If the guard were absent, prisma would be invoked
    // against it and would create the full global schema.
    process.env.DATABASE_URL =
      'postgresql://u:p@rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net:6432/liqvia_ru';

    expect(() => runMigrations()).not.toThrow();
    expect(logs.join('\n')).toContain('refusing to apply the global schema');
    // It must not have reached the "applying migrations" stage at all.
    expect(logs.join('\n')).not.toContain('Applying pending database migrations');
  });

  it('does not depend on SKIP_DB_MIGRATE being remembered', () => {
    process.env.LIQVIA_DATA_PLANE = 'ru';
    process.env.DATABASE_URL =
      'postgresql://u:p@rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net:6432/liqvia_ru';
    delete process.env.SKIP_DB_MIGRATE;

    runMigrations();
    expect(logs.join('\n')).toContain('refusing to apply the global schema');
  });

  it('still skips quietly on the global plane when DATABASE_URL is absent', () => {
    delete process.env.LIQVIA_DATA_PLANE;
    delete process.env.DATABASE_URL;
    expect(() => runMigrations()).not.toThrow();
  });
});

describe('demo seeding on the RU data plane', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('is skipped entirely, without touching Prisma', async () => {
    // The seeder counts WeeklyActual — a global table that does not exist in the
    // RU database. If it ran, the first query would throw P2021 and the process
    // would die before serving a request. Passing a poisoned app proves it is
    // never resolved from the container at all.
    const { runDemoSeedOnStartup } = await import('../demo/demo-seed.runner');
    process.env.LIQVIA_DATA_PLANE = 'ru';
    process.env.DATABASE_URL =
      'postgresql://u:p@rc1a-9lnpkf5j4gimf0hm.mdb.yandexcloud.net:6432/liqvia_ru';

    const poisoned = {
      get() {
        throw new Error('runDemoSeedOnStartup must not resolve Prisma on the RU plane');
      },
    } as never;

    await expect(runDemoSeedOnStartup(poisoned)).resolves.toBeUndefined();
  });
});
