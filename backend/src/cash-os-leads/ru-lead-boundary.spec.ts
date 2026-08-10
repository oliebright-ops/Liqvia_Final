/**
 * The boundaries a Russian lead submission must not cross (Phases V, Q, X, L).
 *
 * Each test here proves a negative — that submitting a lead does NOT do something. Negatives
 * are the ones worth automating, because nobody notices when they stop holding: a lead that
 * quietly starts reaching OpenAI, or a personal-data value that quietly starts appearing in a
 * log line, produces no error and no failing feature. The first symptom is an audit.
 */
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
} from '@liqvia2/shared';
import { ConsentService } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashOsLeadsService } from './cash-os-leads.service';
import { CreateCashOsLeadDto } from './dto/create-cash-os-lead.dto';

const ACTIVE_VERSION = ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT];

/** Synthetic, but shaped like real Russian lead data so redaction is genuinely exercised. */
const IDENTIFYING_VALUES = {
  name: 'Иван Петров',
  companyName: 'ООО «Ромашка»',
  email: 'ivan.petrov@example.com',
  phone: '+7 916 555 44 33',
  comment: 'Хотим обсудить прогноз ДДС. Мой второй контакт: petrov.backup@example.com',
  role: 'Генеральный директор',
};

function validDto(): CreateCashOsLeadDto {
  return {
    ...IDENTIFYING_VALUES,
    consent: {
      subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
      version: ACTIVE_VERSION,
      consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT,
      locale: 'ru',
      accepted: true,
      acknowledgedAt: new Date().toISOString(),
    },
  } as CreateCashOsLeadDto;
}

function buildService(overrides: { transaction?: jest.Mock } = {}) {
  const tx = {
    cashOsLead: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'lead-1',
        ...data,
      })),
    },
    consentRecord: { create: jest.fn(async ({ data }: { data: unknown }) => data) },
  };

  const prisma = {
    $transaction:
      overrides.transaction ??
      jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;

  return { service: new CashOsLeadsService(prisma, new ConsentService(prisma)), prisma };
}

/* ------------------------------------------------------------------------- */
/* Phase V — no AI provider is reachable from the lead path                   */
/* ------------------------------------------------------------------------- */

describe('RU lead submission → zero AI calls', () => {
  it('makes no outbound network call of any kind while storing a lead', async () => {
    // `fetch` is how both the OpenAI SDK and any future provider ultimately leave the
    // process. Asserting on it rather than on a mocked SDK means a new provider added
    // tomorrow, by any route, still trips this test.
    const globalWithFetch = globalThis as { fetch?: typeof fetch };
    const original = globalWithFetch.fetch;
    const spy = jest.fn(async () => new Response('{}'));
    globalWithFetch.fetch = spy as unknown as typeof fetch;

    try {
      const { service } = buildService();
      await service.create(validDto());
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalWithFetch.fetch = original;
    }
  });

  it('depends on nothing beyond Prisma and the consent registry', () => {
    // A structural assertion: the constructor's shape is the dependency boundary. If a
    // mail client, an HTTP client or an AI gateway is ever injected here, this fails.
    expect(CashOsLeadsService.length).toBe(2);
  });
});

/* ------------------------------------------------------------------------- */
/* Phase Q — no personal data reaches a log sink                              */
/* ------------------------------------------------------------------------- */

describe('RU lead personal data → never in logs', () => {
  const captured: string[] = [];
  let spies: jest.SpyInstance[] = [];

  beforeEach(() => {
    captured.length = 0;
    const collect = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };
    spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(collect),
    );
  });

  afterEach(() => spies.forEach((s) => s.mockRestore()));

  function assertNoIdentityLogged() {
    const all = captured.join('\n');
    for (const [field, value] of Object.entries(IDENTIFYING_VALUES)) {
      expect(all).not.toContain(value);
      // The local part of an email is identifying even without the domain.
      if (field === 'email') expect(all).not.toContain('ivan.petrov');
    }
  }

  it('logs nothing identifying on a successful submission', async () => {
    const { service } = buildService();
    await service.create(validDto());
    assertNoIdentityLogged();
  });

  it('logs nothing identifying when the database write fails', async () => {
    // The dangerous case. A Prisma write error embeds the row it failed to write, so an
    // unredacted `${err}` here would print the whole lead into the platform log sink.
    const failing = jest.fn(async () => {
      throw new Error(
        'Invalid `prisma.cashOsLead.create()` invocation: Unique constraint failed. ' +
          `data: { name: "${IDENTIFYING_VALUES.name}", email: "${IDENTIFYING_VALUES.email}", ` +
          `phone: "${IDENTIFYING_VALUES.phone}", comment: "${IDENTIFYING_VALUES.comment}" }`,
      );
    });

    const { service } = buildService({ transaction: failing });
    await expect(service.create(validDto())).rejects.toThrow(ServiceUnavailableException);

    assertNoIdentityLogged();
    expect(captured.join('\n')).toContain('could not be stored');
  });

  it('logs nothing identifying when a superseded consent version is used', async () => {
    const { service } = buildService();
    const dto = validDto();
    dto.consent!.version = '2026-08-09.1';
    dto.consent!.consentText = 'Отправляя форму, вы соглашаетесь…';

    await service.create(dto);
    assertNoIdentityLogged();
  });
});

/* ------------------------------------------------------------------------- */
/* Phase X — fail closed, never fall back                                     */
/* ------------------------------------------------------------------------- */

describe('RU database unavailable → no fallback', () => {
  it('rejects the submission instead of storing it somewhere else', async () => {
    const failing = jest.fn(async () => {
      throw new Error("Can't reach database server at rc1a-abc.mdb.yandexcloud.net:6432");
    });
    const { service, prisma } = buildService({ transaction: failing });

    await expect(service.create(validDto())).rejects.toThrow(ServiceUnavailableException);

    // Exactly one attempt, at one destination. No retry against another database.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('tells the visitor to retry rather than claiming the enquiry was received', async () => {
    // A person told "thank you, we'll be in touch" does not resend. Reporting success for
    // a lead that was never stored loses the enquiry silently.
    const failing = jest.fn(async () => {
      throw new Error('connection refused');
    });
    const { service } = buildService({ transaction: failing });

    await expect(service.create(validDto())).rejects.toMatchObject({
      message: expect.stringContaining('попробуйте отправить форму ещё раз'),
    });
  });

  it('stores no personal data anywhere when the write fails', async () => {
    const attempted: unknown[] = [];
    const failing = jest.fn(async (fn: (c: unknown) => Promise<unknown>) => {
      const tx = {
        cashOsLead: {
          create: jest.fn(async ({ data }: { data: unknown }) => {
            attempted.push(data);
            throw new Error('write failed');
          }),
        },
        consentRecord: { create: jest.fn() },
      };
      return fn(tx);
    });

    const { service } = buildService({ transaction: failing as unknown as jest.Mock });
    await expect(service.create(validDto())).rejects.toThrow(ServiceUnavailableException);

    // The write was attempted once, inside the transaction that then rolled back. What
    // matters is that nothing was written to a *second* destination after it failed.
    expect(attempted).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------- */
/* Phase L — no identity leaves through analytics or URLs                     */
/* ------------------------------------------------------------------------- */

describe('RU identity → never in the campaign source field', () => {
  it('stores a campaign tag, never a URL or query string', async () => {
    let stored: Record<string, unknown> | undefined;
    const capture = jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        cashOsLead: {
          create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
            stored = data;
            return { id: 'lead-1', ...data };
          }),
        },
        consentRecord: { create: jest.fn(async ({ data }: { data: unknown }) => data) },
      }),
    );

    const { service } = buildService({ transaction: capture as unknown as jest.Mock });
    await service.create({ ...validDto(), source: 'ru_cash_visibility_01' });

    expect(stored?.source).toBe('ru_cash_visibility_01');
    // A URL in `source` would drag yclid, UTM values and anything else in the address
    // bar into the lead table alongside the person's name. See docs/RU_METRICA_VERIFICATION.md §5.2.
    expect(String(stored?.source)).not.toMatch(/https?:|[?&]|yclid/);
  });
});
