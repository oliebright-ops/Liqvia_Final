/**
 * What the lead endpoint accepts, and what it writes as evidence.
 *
 * The form shows a passive notice, so the shipped client sends no consent object
 * and the server records the notice itself. The central rule these tests hold in
 * place is that the two cases stay distinguishable in the database: a submission
 * where nobody ticked anything must never produce a row that looks like a tick.
 *
 * Anything can POST here, so the affirmative path — still reachable from a cached
 * pre-change bundle — is exercised too, and stays strict.
 *
 * No database: the transaction is faked, so the assertions are about the
 * service's own rules rather than about Prisma.
 */
import { BadRequestException } from '@nestjs/common';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CASH_OS_LEAD_FORM_NOTICE_TEXT,
  LEAD_NOTICE_SUBJECT,
  LEAD_NOTICE_VERSION,
  MARKETING_LEAD_CONSENT_SUBJECT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
} from '@liqvia2/shared';
import { ConsentService } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashOsLeadsService } from './cash-os-leads.service';
import { CreateCashOsLeadDto } from './dto/create-cash-os-lead.dto';

const ACTIVE_VERSION = ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT];

interface Written {
  leads: Record<string, unknown>[];
  consents: Record<string, unknown>[];
}

function build() {
  const written: Written = { leads: [], consents: [] };

  const tx = {
    cashOsLead: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        written.leads.push(data);
        return { id: `lead-${written.leads.length}`, ...data };
      }),
    },
    consentRecord: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        written.consents.push(data);
        return { id: `consent-${written.consents.length}`, ...data };
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;

  const service = new CashOsLeadsService(prisma, new ConsentService(prisma));
  return { service, written };
}

/** What the shipped client sends: a filled form and no consent claim of any kind. */
function validDto(overrides: Partial<CreateCashOsLeadDto> = {}): CreateCashOsLeadDto {
  return {
    name: 'Иван Петров',
    companyName: 'ООО «Пример»',
    email: 'ivan@example.com',
    ...overrides,
  } as CreateCashOsLeadDto;
}

type Consent = NonNullable<CreateCashOsLeadDto['consent']>;

/** A genuine tick, as a cached pre-change bundle still posts one. */
function tickedConsent(overrides: Partial<Consent> = {}): Consent {
  return {
    subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
    version: ACTIVE_VERSION,
    consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT,
    locale: 'ru',
    accepted: true,
    acknowledgedAt: new Date().toISOString(),
    ...overrides,
  } as Consent;
}

describe('CashOsLeadsService — passive notice', () => {
  it('accepts a submission with no consent object and records both rows in one transaction', async () => {
    const { service, written } = build();

    await expect(service.create(validDto())).resolves.toEqual({ status: 'ok' });

    expect(written.leads).toHaveLength(1);
    expect(written.consents).toHaveLength(1);
    expect(written.consents[0]).toMatchObject({
      subjectId: LEAD_NOTICE_SUBJECT,
      version: LEAD_NOTICE_VERSION,
      locale: 'ru',
      textVerified: true,
      cashOsLeadId: 'lead-1',
    });
    expect(written.consents[0].consentText).toBe(CASH_OS_LEAD_FORM_NOTICE_TEXT);
  });

  it('records the notice as a notice, never as a tick', async () => {
    // The whole point of the passive flow: the row must not claim an act the
    // visitor did not perform, and must stay distinguishable from one that did.
    const { service, written } = build();

    await service.create(validDto());

    expect(written.consents[0].method).toBe('passive-notice');
    expect(written.consents[0].method).not.toBe('checkbox');
  });

  it('records the wording from the server registry, not from the request', async () => {
    // A passive notice is a property of the page, so a caller cannot report one —
    // and must not be able to substitute a wording of its own choosing.
    const { service, written } = build();

    await service.create(
      validDto({ consentText: 'что-то придуманное' } as Partial<CreateCashOsLeadDto>),
    );

    expect(written.consents[0].consentText).toBe(CASH_OS_LEAD_FORM_NOTICE_TEXT);
  });

  it('timestamps the notice at submission time rather than trusting the client', async () => {
    const { service, written } = build();
    const before = Date.now();

    await service.create(validDto());

    const acknowledgedAt = written.consents[0].acknowledgedAt as Date;
    expect(acknowledgedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(acknowledgedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('records which form displayed the notice, on both the lead and the evidence', async () => {
    // The consent link is SetNull, so a hard-deleted lead must not take the
    // answer to "obtained on which form?" with it.
    const { service, written } = build();

    await service.create(validDto({ source: 'cash-operating-system-landing' }));

    expect(written.leads[0]).toMatchObject({ source: 'cash-operating-system-landing' });
    expect(written.consents[0]).toMatchObject({ source: 'cash-operating-system-landing' });
  });

  it('stores no form source when the submission carries none, rather than inventing one', async () => {
    const { service, written } = build();

    await service.create(validDto({ source: undefined }));

    expect(written.leads[0]).toMatchObject({ source: null });
    expect(written.consents[0]).toMatchObject({ source: null });
  });
});

describe('CashOsLeadsService — affirmative consent from a cached client', () => {
  it('accepts a genuine tick and records it as one', async () => {
    const { service, written } = build();

    await expect(service.create(validDto({ consent: tickedConsent() }))).resolves.toEqual({
      status: 'ok',
    });

    expect(written.consents).toHaveLength(1);
    expect(written.consents[0]).toMatchObject({
      subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
      version: ACTIVE_VERSION,
      method: 'checkbox',
      textVerified: true,
    });
  });

  it('records the acknowledgement timestamp the client reported when it is plausible', async () => {
    const { service, written } = build();
    const acknowledgedAt = new Date(Date.now() - 30_000).toISOString();

    await service.create(validDto({ consent: tickedConsent({ acknowledgedAt }) }));

    expect((written.consents[0].acknowledgedAt as Date).toISOString()).toBe(acknowledgedAt);
  });

  it('rejects an explicit refusal rather than downgrading it to a notice', async () => {
    // Someone who unticked the box on a cached bundle refused. Storing the passive
    // notice instead would overwrite that refusal with something weaker.
    const { service, written } = build();

    await expect(
      service.create(validDto({ consent: tickedConsent({ accepted: false }) })),
    ).rejects.toThrow(/согласие на обработку персональных данных/i);
    expect(written.leads).toHaveLength(0);
  });

  it('rejects a consent whose `accepted` flag is missing rather than affirmative', async () => {
    // An omitted flag is not a refusal, but it is not a conscious acknowledgement
    // either. Silence must not be stored as evidence that someone agreed.
    const { service, written } = build();
    const { accepted: _omitted, ...withoutFlag } = tickedConsent();

    await expect(
      service.create(validDto({ consent: withoutFlag as CreateCashOsLeadDto['consent'] })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(written.leads).toHaveLength(0);
    expect(written.consents).toHaveLength(0);
  });

  it('refuses to store the passive notice as though it were a tick', async () => {
    // The notice is registered, so a caller can name it — but it is registered as
    // `notice`, and the affirmative path accepts only `required` wordings.
    const { service, written } = build();

    await expect(
      service.create(
        validDto({
          consent: tickedConsent({
            version: LEAD_NOTICE_VERSION,
            consentText: CASH_OS_LEAD_FORM_NOTICE_TEXT,
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(written.leads).toHaveLength(0);
  });

  it('rejects a consent version this server does not know', async () => {
    const { service } = build();

    await expect(
      service.create(validDto({ consent: tickedConsent({ version: '1999-01-01.1' }) })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an optional notice submitted in place of the required one', async () => {
    const { service } = build();

    await expect(
      service.create(
        validDto({ consent: tickedConsent({ subjectId: MARKETING_LEAD_CONSENT_SUBJECT }) }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still delivers the lead when a cached client posts a superseded wording version', async () => {
    // Lead delivery must not break during a wording rollout; the evidence simply
    // records the version that person actually saw.
    const { service, written } = build();

    await expect(
      service.create(
        validDto({
          consent: tickedConsent({
            version: '2026-08-09.1',
            consentText: 'что-то устаревшее',
          }),
        }),
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(written.leads).toHaveLength(1);
    expect(written.consents[0]).toMatchObject({ version: '2026-08-09.1', textVerified: false });
  });
});

describe('CashOsLeadsService — optional marketing consent', () => {
  it('does not record a marketing consent while promotional messaging is disabled', async () => {
    const { service, written } = build();

    await service.create(
      validDto({
        marketingConsent: {
          subjectId: MARKETING_LEAD_CONSENT_SUBJECT,
          version: ACTIVE_CONSENT_VERSION[MARKETING_LEAD_CONSENT_SUBJECT],
          consentText: 'что угодно',
          locale: 'ru',
          accepted: true,
        },
      }),
    );

    // The lead is still delivered — the marketing box never gates the submission.
    expect(written.leads).toHaveLength(1);
    expect(written.consents).toHaveLength(1);
    expect(written.consents[0].subjectId).toBe(REQUIRED_LEAD_CONSENT_SUBJECT);
  });

  it('does not record a marketing consent whose `accepted` flag was omitted', async () => {
    // Dropped silently rather than rejected: the marketing box never gates the lead.
    const { service, written } = build();

    await service.create(
      validDto({
        marketingConsent: {
          subjectId: MARKETING_LEAD_CONSENT_SUBJECT,
          version: ACTIVE_CONSENT_VERSION[MARKETING_LEAD_CONSENT_SUBJECT],
          consentText: 'что угодно',
          locale: 'ru',
        } as CreateCashOsLeadDto['consent'],
      }),
    );

    expect(written.leads).toHaveLength(1);
    expect(written.consents).toHaveLength(1);
    expect(written.consents[0].subjectId).toBe(REQUIRED_LEAD_CONSENT_SUBJECT);
  });

  it('never infers marketing consent from the required consent', async () => {
    const { service, written } = build();

    await service.create(validDto());

    expect(
      written.consents.some((c) => c.subjectId === MARKETING_LEAD_CONSENT_SUBJECT),
    ).toBe(false);
  });
});

/**
 * Field length ceilings.
 *
 * The endpoint is unauthenticated and every text column is unbounded, so the
 * rate limit alone only caps how often a caller submits — not how much each
 * submission stores. These tests fix the boundary in place: a realistic Russian
 * enquiry must pass, and an oversized one must be refused before any write.
 */
describe('CashOsLeadsService — input length limits', () => {
  it('accepts a long but realistic Russian enquiry', async () => {
    const { service, written } = build();

    await expect(
      service.create(
        validDto({
          name: 'Александр Константинопольский-Мирославский',
          companyName: 'Общество с ограниченной ответственностью «Стройтехмонтаж-Инжиниринг»',
          role: 'Заместитель генерального директора по финансам и экономике',
          comment: 'Хотим обсудить прогноз ДДС на 13 недель. '.repeat(50),
          industry: 'Строительство и проектирование',
          phone: '+7 900 000-00-00',
        }),
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(written.leads).toHaveLength(1);
  });

  it.each([
    ['name', 201],
    ['companyName', 201],
    ['role', 201],
    ['phone', 65],
    ['employeeCount', 33],
    ['industry', 121],
    ['comment', 5_001],
    ['source', 121],
  ])('rejects an oversized %s and writes nothing', async (field, length) => {
    const { service, written } = build();

    await expect(
      service.create(validDto({ [field]: 'я'.repeat(length) })),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(written.leads).toHaveLength(0);
    expect(written.consents).toHaveLength(0);
  });

  it('rejects an oversized email', async () => {
    const { service, written } = build();
    const oversized = `${'a'.repeat(310)}@example.com`;

    await expect(
      service.create(validDto({ email: oversized })),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(written.leads).toHaveLength(0);
  });

  it('rejects oversized consent evidence before writing the lead', async () => {
    const { service, written } = build();

    await expect(
      service.create(
        validDto({
          consent: {
            subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
            version: ACTIVE_VERSION,
            consentText: 'x'.repeat(5_001),
            locale: 'ru',
            accepted: true,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(written.leads).toHaveLength(0);
    expect(written.consents).toHaveLength(0);
  });

  it('never echoes the submitted value back in the error message', async () => {
    const { service } = build();
    const marker = 'СЕКРЕТНОЕ-ЗНАЧЕНИЕ';

    await expect(
      service.create(validDto({ comment: `${marker}${'я'.repeat(5_001)}` })),
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(marker),
      }),
    );
  });
});
