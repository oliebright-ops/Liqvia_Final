import { Prisma } from '@prisma/client';
import { NotificationsService } from './notifications.service';

function makeService(opts: {
  nextDueDates?: Array<{
    obligationId: string;
    name: string;
    category: string;
    amount: number;
    dueDate: string;
  }>;
  forecastLines?: Array<{ weekStart: string; closingCash: number }>;
  runwayWeeks?: number | null;
  companyPlan?: 'free' | 'pro';
  existingNotifications?: Array<Record<string, unknown>>;
}) {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    notification: {
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve(args.data);
      }),
      findMany: jest.fn().mockResolvedValue(opts.existingNotifications ?? []),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ plan: opts.companyPlan ?? 'free' }),
    },
  };
  const recurringObligations = {
    nextDueDates: jest.fn().mockResolvedValue(opts.nextDueDates ?? []),
  };
  const treasuryEngine = {
    generateForCompany: jest.fn().mockResolvedValue({
      forecastLines: opts.forecastLines ?? [],
      runwayWeeks: opts.runwayWeeks ?? null,
    }),
  };
  const service = new NotificationsService(
    prisma as never,
    recurringObligations as never,
    treasuryEngine as never,
  );
  return { service, prisma, created };
}

describe('NotificationsService.refreshForCompany', () => {
  const REAL_DATE_NOW = Date.now;
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-04T00:00:00.000Z'));
  });
  afterAll(() => {
    jest.useRealTimers();
    Date.now = REAL_DATE_NOW;
  });

  it('creates an obligation-due-soon notification for an obligation due within 7 days', async () => {
    const { service, created } = makeService({
      nextDueDates: [
        {
          obligationId: 'ob-1',
          name: 'Office rent',
          category: 'rent',
          amount: 4000,
          dueDate: '2026-07-08',
        },
      ],
    });

    await service.refreshForCompany('company-1');

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      type: 'obligation_due_soon',
      severity: 'warning',
      dedupeKey: 'obligation_due_soon:ob-1:2026-07-04',
    });
  });

  it('does not create an obligation-due-soon notification for a due date beyond the 7-day window', async () => {
    const { created } = await (async () => {
      const s = makeService({
        nextDueDates: [
          {
            obligationId: 'ob-2',
            name: 'Annual insurance',
            category: 'insurance',
            amount: 1200,
            dueDate: '2026-08-01',
          },
        ],
      });
      await s.service.refreshForCompany('company-1');
      return s;
    })();

    expect(created).toHaveLength(0);
  });

  it('creates a payroll-shortfall notification when a negative forecast week overlaps a payroll due date', async () => {
    const { created } = await (async () => {
      const s = makeService({
        nextDueDates: [
          {
            obligationId: 'ob-3',
            name: 'Payroll run',
            category: 'payroll',
            amount: 20000,
            dueDate: '2026-07-15',
          },
        ],
        forecastLines: [
          { weekStart: '2026-07-13', closingCash: -5000 },
          { weekStart: '2026-07-20', closingCash: 3000 },
        ],
      });
      await s.service.refreshForCompany('company-1');
      return s;
    })();

    expect(created.some((d) => d.type === 'payroll_shortfall')).toBe(true);
  });

  it('does not create a payroll-shortfall notification when the negative week has no overlapping payroll due date', async () => {
    const { created } = await (async () => {
      const s = makeService({
        forecastLines: [{ weekStart: '2026-07-13', closingCash: -5000 }],
      });
      await s.service.refreshForCompany('company-1');
      return s;
    })();

    expect(created.some((d) => d.type === 'payroll_shortfall')).toBe(false);
  });

  it('creates a critical runway-risk notification when runway is under 2 weeks', async () => {
    const { created } = await (async () => {
      const s = makeService({ runwayWeeks: 1.2 });
      await s.service.refreshForCompany('company-1');
      return s;
    })();

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ type: 'runway_risk', severity: 'critical' });
  });

  it('creates a warning runway-risk notification when runway is between 2 and 6 weeks', async () => {
    const { created } = await (async () => {
      const s = makeService({ runwayWeeks: 4 });
      await s.service.refreshForCompany('company-1');
      return s;
    })();

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ type: 'runway_risk', severity: 'warning' });
  });

  it('creates no runway-risk notification when runway is comfortably above the threshold', async () => {
    const { created } = await (async () => {
      const s = makeService({ runwayWeeks: 12 });
      await s.service.refreshForCompany('company-1');
      return s;
    })();

    expect(created).toHaveLength(0);
  });

  it('swallows a duplicate-notification (P2002) error without throwing', async () => {
    const { service, prisma } = makeService({ runwayWeeks: 1 });
    (prisma.notification.create as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(service.refreshForCompany('company-1')).resolves.toBeUndefined();
  });
});

describe('NotificationsService.list', () => {
  it('returns a locked preview for a free-plan company', async () => {
    const { service } = makeService({
      companyPlan: 'free',
      existingNotifications: [
        { id: 'n1', severity: 'critical', type: 'runway_risk', read: false },
        { id: 'n2', severity: 'warning', type: 'obligation_due_soon', read: true },
      ],
    });

    const result = await service.list('company-1');

    expect(result.locked).toBe(true);
    if (result.locked) {
      expect(result.unreadCount).toBe(1);
      expect(result.preview).toHaveLength(2);
    }
  });

  it('returns the full notification list for a pro-plan company', async () => {
    const { service } = makeService({
      companyPlan: 'pro',
      existingNotifications: [{ id: 'n1', severity: 'critical', type: 'runway_risk', read: false }],
    });

    const result = await service.list('company-1');

    expect(result.locked).toBe(false);
    if (!result.locked) {
      expect(result.notifications).toHaveLength(1);
    }
  });
});
