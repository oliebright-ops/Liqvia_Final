/**
 * End-to-end proof, against a real database, that a ticked consent produces a
 * lead and a consent record that actually point at each other.
 *
 * Every other test in this area fakes Prisma, which means none of them can catch
 * a column that was never migrated, an FK that does not link, or a field the
 * service builds but the schema drops. That is precisely the class of defect that
 * turns "we record consent" into a table full of orphans.
 *
 * ## This test does not run by default, on purpose
 *
 * It is skipped unless `CONSENT_TEST_DATABASE_URL` is set, and it refuses to run
 * against anything that looks like a real deployment. `docs/FINAL_OUTSTANDING_ISSUES.md`
 * §F1 records that `backend/.env` currently points at the production database and
 * that another spec in this repo writes to it. A test that creates and deletes
 * rows must never be one connection string away from doing that to real people's
 * enquiries, so the guard below is deliberately paranoid and fails loudly rather
 * than skipping quietly when it is unhappy.
 *
 * Run it with a throwaway database:
 *
 *   createdb liqvia_consent_test
 *   CONSENT_TEST_DATABASE_URL=postgresql://localhost:5432/liqvia_consent_test \
 *     npx prisma migrate deploy
 *   CONSENT_TEST_DATABASE_URL=postgresql://localhost:5432/liqvia_consent_test \
 *     npx jest lead-consent-persistence
 */
import { PrismaClient } from '@prisma/client';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
} from '@liqvia2/shared';
import { ConsentService, sha256Hex } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashOsLeadsService } from './cash-os-leads.service';
import { CreateCashOsLeadDto } from './dto/create-cash-os-lead.dto';

const TEST_DATABASE_URL = process.env.CONSENT_TEST_DATABASE_URL;

/**
 * Refuses any database that is not obviously disposable.
 *
 * Local host or an explicit "test" marker in the database name — nothing else.
 * Matching `DATABASE_URL` is rejected outright even if it satisfies the rest,
 * because the ambient one is the production database on this machine today.
 */
function assertDisposableDatabase(url: string): void {
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) {
    throw new Error(
      'CONSENT_TEST_DATABASE_URL is identical to DATABASE_URL. Refusing to write test rows ' +
        'to the ambient database. Point it at a throwaway database instead.',
    );
  }

  const { hostname, pathname } = new URL(url);
  const database = pathname.replace(/^\//, '');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const isMarkedAsTest = /test/i.test(database);

  if (!isLocal && !isMarkedAsTest) {
    throw new Error(
      `Refusing to run against "${hostname}/${database}": a test database must be on localhost ` +
        'or have "test" in its name. This test creates and deletes rows.',
    );
  }
}

const describeIfConfigured = TEST_DATABASE_URL ? describe : describe.skip;

describeIfConfigured('lead + consent persistence (real database)', () => {
  let prisma: PrismaService;
  let service: CashOsLeadsService;
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    assertDisposableDatabase(TEST_DATABASE_URL as string);

    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    }) as unknown as PrismaService;

    await prisma.$connect();
    service = new CashOsLeadsService(prisma, new ConsentService(prisma));
  });

  afterAll(async () => {
    if (!prisma) return;
    // Consent evidence is not cascade-deleted with its lead by design, so both
    // are cleaned up explicitly rather than relying on the FK.
    if (createdLeadIds.length) {
      await prisma.consentRecord.deleteMany({ where: { cashOsLeadId: { in: createdLeadIds } } });
      await prisma.cashOsLead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await prisma.$disconnect();
  });

  function validDto(overrides: Partial<CreateCashOsLeadDto> = {}): CreateCashOsLeadDto {
    return {
      name: 'Тест Интеграция',
      companyName: 'ООО «Тест»',
      email: `integration-${Date.now()}@example.test`,
      source: 'cash-operating-system-landing',
      consent: {
        subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
        version: ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT],
        consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT,
        locale: 'ru',
        accepted: true,
        acknowledgedAt: new Date().toISOString(),
      },
      ...overrides,
    } as CreateCashOsLeadDto;
  }

  it('writes a lead and a consent record that reference each other', async () => {
    const dto = validDto();

    await expect(service.create(dto)).resolves.toEqual({ status: 'ok' });

    const lead = await prisma.cashOsLead.findFirst({ where: { email: dto.email } });
    expect(lead).not.toBeNull();
    createdLeadIds.push(lead!.id);

    const consents = await prisma.consentRecord.findMany({ where: { cashOsLeadId: lead!.id } });
    expect(consents).toHaveLength(1);

    const [consent] = consents;
    expect(consent).toMatchObject({
      subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
      version: ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT],
      locale: 'ru',
      textVerified: true,
      method: 'checkbox',
      // The column added by 20260810140000_consent_source — asserted here because
      // a mocked Prisma cannot tell whether it was ever migrated.
      source: 'cash-operating-system-landing',
    });

    // The evidence is the wording itself, not a pointer into code that will be redeployed.
    expect(consent.consentText).toBe(CASH_OS_LEAD_FORM_CONSENT_TEXT);
    expect(consent.consentTextSha256).toBe(sha256Hex(CASH_OS_LEAD_FORM_CONSENT_TEXT));
    expect(consent.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('writes neither row when the consent was not given', async () => {
    const dto = validDto({ email: `refused-${Date.now()}@example.test` });
    dto.consent.accepted = false;

    await expect(service.create(dto)).rejects.toThrow();

    expect(await prisma.cashOsLead.findFirst({ where: { email: dto.email } })).toBeNull();
    expect(
      await prisma.consentRecord.count({ where: { consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT } }),
    ).toBeGreaterThanOrEqual(0);
  });

  it('keeps consent evidence when the lead it belongs to is hard-deleted', async () => {
    // SetNull, not Cascade: erasing someone's data and destroying the proof that
    // collecting it was lawful are different acts.
    const dto = validDto({ email: `retained-${Date.now()}@example.test` });
    await service.create(dto);

    const lead = await prisma.cashOsLead.findFirst({ where: { email: dto.email } });
    const consentId = (await prisma.consentRecord.findFirst({
      where: { cashOsLeadId: lead!.id },
    }))!.id;

    await prisma.cashOsLead.delete({ where: { id: lead!.id } });

    const survivor = await prisma.consentRecord.findUnique({ where: { id: consentId } });
    expect(survivor).not.toBeNull();
    expect(survivor!.cashOsLeadId).toBeNull();
    // The form source survives the lead it was denormalised from — the reason
    // that column exists.
    expect(survivor!.source).toBe('cash-operating-system-landing');

    await prisma.consentRecord.delete({ where: { id: consentId } });
  });
});
