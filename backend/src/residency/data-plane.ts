/**
 * Which data plane this process is serving.
 *
 * Liqvia runs one codebase as two deployments (see docs/RU_YANDEX_CLOUD_ARCHITECTURE.md §2):
 *
 *   global — Render, PostgreSQL in Oregon, the authenticated product
 *   ru     — Yandex Cloud, PostgreSQL in Russia, liqvia.info lead capture only
 *
 * The distinction exists because a Russian lead written to the global database is not a
 * degraded outcome, it is the specific outcome the RU plane exists to prevent. So the plane
 * is an explicit input rather than something inferred from a hostname or a connection string:
 * inference fails silently and in the unsafe direction.
 */

export type DataPlane = 'global' | 'ru';

/** Environment variable naming the plane. Unset means `global`, which is today's behaviour. */
export const DATA_PLANE_ENV = 'LIQVIA_DATA_PLANE';

/** Names the RU database must be recognisable by. */
const RU_DATABASE_HOST_MARKERS = ['.mdb.yandexcloud.net', '.rw.mdb.yandexcloud.net'];

/**
 * Hosts that are definitively NOT in Russia.
 *
 * Deliberately a list of things known to be foreign rather than a list of things known to be
 * Russian: a typo in a Yandex hostname should not read as "not Russian, therefore fine", and an
 * unrecognised host should not be silently trusted either. See {@link assertResidency}.
 */
const NON_RU_DATABASE_HOST_MARKERS = [
  'render.com',
  'oregon-postgres',
  'amazonaws.com',
  'neon.tech',
  'supabase.co',
  'azure.com',
  'googleapis.com',
];

export function currentDataPlane(env: NodeJS.ProcessEnv = process.env): DataPlane {
  const raw = env[DATA_PLANE_ENV]?.trim().toLowerCase();
  if (!raw) return 'global';
  if (raw === 'ru' || raw === 'global') return raw;
  // An unrecognised value is a deployment mistake. Refusing to guess is the whole point.
  throw new Error(
    `${DATA_PLANE_ENV}="${raw}" is not a known data plane. Use "ru" or "global".`,
  );
}

export function isRuDataPlane(env: NodeJS.ProcessEnv = process.env): boolean {
  return currentDataPlane(env) === 'ru';
}

/** Extracts the host from a PostgreSQL URL without exposing credentials to callers. */
export function databaseHost(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Thrown when the process is configured for Russia but is not pointed at Russian storage.
 *
 * Separate from a generic error so the boot sequence can be explicit that this is a residency
 * failure and not a transient connectivity problem.
 */
export class ResidencyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResidencyViolationError';
  }
}

/**
 * Refuses to start an RU deployment that would write Russian personal data outside Russia.
 *
 * Called once during boot. Failing here — loudly, before the process accepts a single request —
 * is the entire mechanism: the alternative is a deployment that looks healthy while quietly
 * filing Russian leads in Oregon, which is indistinguishable from success until someone audits
 * the database.
 *
 * An unrecognised host is treated as a failure rather than as "probably fine". Residency is
 * exactly the kind of property where "I don't recognise this" must not mean "carry on".
 */
export function assertResidency(env: NodeJS.ProcessEnv = process.env): void {
  if (currentDataPlane(env) !== 'ru') return;

  const host = databaseHost(env.DATABASE_URL);

  if (!host) {
    throw new ResidencyViolationError(
      `${DATA_PLANE_ENV}=ru but DATABASE_URL is missing or unparseable. ` +
        'Refusing to start: an RU deployment must be pointed at RU storage.',
    );
  }

  const foreign = NON_RU_DATABASE_HOST_MARKERS.find((marker) => host.includes(marker));
  if (foreign) {
    throw new ResidencyViolationError(
      `${DATA_PLANE_ENV}=ru but DATABASE_URL points at "${host}", which is not Russian ` +
        `infrastructure (matched "${foreign}"). Refusing to start: Russian lead data must ` +
        'never be written to the global database.',
    );
  }

  const looksRussian = RU_DATABASE_HOST_MARKERS.some((marker) => host.endsWith(marker));
  if (!looksRussian) {
    throw new ResidencyViolationError(
      `${DATA_PLANE_ENV}=ru but DATABASE_URL host "${host}" is not a recognised Russian ` +
        'database host. Refusing to start rather than assuming residency. If this host is ' +
        'genuinely Russian, add it to RU_DATABASE_HOST_MARKERS deliberately.',
    );
  }
}
