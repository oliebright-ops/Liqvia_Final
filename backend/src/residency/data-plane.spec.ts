/**
 * The residency boundary must fail closed (Phase X).
 *
 * These tests exist because the failure they guard against is invisible: an RU deployment
 * pointed at the global database serves traffic perfectly, returns 200s, and files Russian
 * personal data in Oregon. Nothing alerts. The only way to notice is to audit the database
 * afterwards, by which point the data is already in the wrong jurisdiction.
 */
import {
  DATA_PLANE_ENV,
  ResidencyViolationError,
  assertResidency,
  currentDataPlane,
  databaseHost,
  isRuDataPlane,
} from './data-plane';

const RU_DB = 'postgresql://u:p@rc1a-abcdef.mdb.yandexcloud.net:6432/liqvia_ru';
const GLOBAL_DB = 'postgresql://u:p@dpg-xyz-a.oregon-postgres.render.com/liqviadb';

describe('data plane selection', () => {
  it('defaults to the global plane when unset, preserving current behaviour', () => {
    expect(currentDataPlane({})).toBe('global');
    expect(isRuDataPlane({})).toBe(false);
  });

  it('reads an explicit plane', () => {
    expect(currentDataPlane({ [DATA_PLANE_ENV]: 'ru' })).toBe('ru');
    expect(currentDataPlane({ [DATA_PLANE_ENV]: 'GLOBAL' })).toBe('global');
    expect(isRuDataPlane({ [DATA_PLANE_ENV]: 'ru' })).toBe(true);
  });

  it('refuses to guess at an unrecognised plane', () => {
    // "russia", "RU-prod", a typo — all are deployment mistakes. Guessing would resolve
    // them to `global`, which is the unsafe direction.
    expect(() => currentDataPlane({ [DATA_PLANE_ENV]: 'russia' })).toThrow(/not a known data plane/);
  });
});

describe('databaseHost', () => {
  it('extracts the host without exposing credentials', () => {
    expect(databaseHost(RU_DB)).toBe('rc1a-abcdef.mdb.yandexcloud.net');
    expect(databaseHost(GLOBAL_DB)).toBe('dpg-xyz-a.oregon-postgres.render.com');
  });

  it('returns null rather than throwing on unusable input', () => {
    expect(databaseHost(undefined)).toBeNull();
    expect(databaseHost('')).toBeNull();
    expect(databaseHost('not a url')).toBeNull();
  });
});

describe('assertResidency — the global plane is unaffected', () => {
  it('permits the global plane to use the global database', () => {
    expect(() => assertResidency({ DATABASE_URL: GLOBAL_DB })).not.toThrow();
  });

  it('permits the global plane with no DATABASE_URL at all', () => {
    // Not this guard's business. Other startup validation covers it.
    expect(() => assertResidency({})).not.toThrow();
  });
});

describe('assertResidency — the RU plane fails closed', () => {
  it('REFUSES TO START when an RU deployment points at the global database', () => {
    expect(() => assertResidency({ [DATA_PLANE_ENV]: 'ru', DATABASE_URL: GLOBAL_DB })).toThrow(
      ResidencyViolationError,
    );
    expect(() => assertResidency({ [DATA_PLANE_ENV]: 'ru', DATABASE_URL: GLOBAL_DB })).toThrow(
      /never be written to the global database/,
    );
  });

  it.each([
    ['AWS', 'postgresql://u:p@db.eu-west-1.rds.amazonaws.com/x'],
    ['Neon', 'postgresql://u:p@ep-cool.eu-central-1.aws.neon.tech/x'],
    ['Supabase', 'postgresql://u:p@db.abcdefgh.supabase.co/x'],
  ])('refuses a %s host on the RU plane', (_name, url) => {
    expect(() => assertResidency({ [DATA_PLANE_ENV]: 'ru', DATABASE_URL: url })).toThrow(
      ResidencyViolationError,
    );
  });

  it('refuses to start when DATABASE_URL is missing on the RU plane', () => {
    expect(() => assertResidency({ [DATA_PLANE_ENV]: 'ru' })).toThrow(/missing or unparseable/);
  });

  it('refuses an UNRECOGNISED host rather than assuming it is Russian', () => {
    // The important case. An unknown host is not evidence of residency, and treating
    // "I don't recognise this" as "probably fine" is how residency guarantees rot.
    expect(() =>
      assertResidency({ [DATA_PLANE_ENV]: 'ru', DATABASE_URL: 'postgresql://u:p@db.example.net/x' }),
    ).toThrow(/not a recognised Russian database host/);
  });

  it('permits a Yandex Managed PostgreSQL host', () => {
    expect(() => assertResidency({ [DATA_PLANE_ENV]: 'ru', DATABASE_URL: RU_DB })).not.toThrow();
  });

  it('is not fooled by a Yandex-looking hostname that is really a foreign host', () => {
    expect(() =>
      assertResidency({
        [DATA_PLANE_ENV]: 'ru',
        DATABASE_URL: 'postgresql://u:p@mdb.yandexcloud.net.oregon-postgres.render.com/x',
      }),
    ).toThrow(ResidencyViolationError);
  });
});
