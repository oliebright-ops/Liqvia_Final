import { DataQualityService } from './data-quality.service';

function fakePrisma(rows: {
  movement?: { movementDate: Date } | null;
  receivable?: { createdAt: Date } | null;
  payable?: { createdAt: Date } | null;
  actual?: { createdAt: Date } | null;
}) {
  return {
    cashMovement: { findFirst: jest.fn().mockResolvedValue(rows.movement ?? null) },
    receivable: { findFirst: jest.fn().mockResolvedValue(rows.receivable ?? null) },
    payable: { findFirst: jest.fn().mockResolvedValue(rows.payable ?? null) },
    weeklyActual: { findFirst: jest.fn().mockResolvedValue(rows.actual ?? null) },
  } as never;
}

describe('DataQualityService', () => {
  const NOW = new Date('2026-07-04T00:00:00.000Z');
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('scores every module as missing (0) when there is no data at all', async () => {
    const service = new DataQualityService(fakePrisma({}));
    const report = await service.getReport('company-1');

    expect(report.score).toBe(0);
    expect(report.modules.bankTransactions.status).toBe('missing');
    expect(report.modules.receivables.status).toBe('missing');
    expect(report.modules.payables.status).toBe('missing');
    expect(report.modules.budgetActuals.status).toBe('missing');
    expect(report.warnings).toHaveLength(4);
  });

  it('scores every module as fresh (100) when all data is recent', async () => {
    const service = new DataQualityService(
      fakePrisma({
        movement: { movementDate: daysAgo(1) },
        receivable: { createdAt: daysAgo(1) },
        payable: { createdAt: daysAgo(1) },
        actual: { createdAt: daysAgo(1) },
      }),
    );
    const report = await service.getReport('company-1');

    expect(report.score).toBe(100);
    expect(Object.values(report.modules).every((m) => m.status === 'fresh')).toBe(true);
    expect(report.warnings).toHaveLength(0);
  });

  it('marks bank transactions stale past 14 days but receivables still fresh at 20 days', async () => {
    const service = new DataQualityService(
      fakePrisma({
        movement: { movementDate: daysAgo(15) },
        receivable: { createdAt: daysAgo(20) },
        payable: { createdAt: daysAgo(20) },
        actual: { createdAt: daysAgo(20) },
      }),
    );
    const report = await service.getReport('company-1');

    expect(report.modules.bankTransactions.status).toBe('stale');
    expect(report.modules.receivables.status).toBe('fresh');
    expect(report.modules.payables.status).toBe('fresh');
    // Budget/actuals stale threshold is 45 days, so 20 days is still fresh.
    expect(report.modules.budgetActuals.status).toBe('fresh');
  });

  it('marks budget/actuals stale past the 45-day threshold', async () => {
    const service = new DataQualityService(
      fakePrisma({
        movement: { movementDate: daysAgo(1) },
        receivable: { createdAt: daysAgo(1) },
        payable: { createdAt: daysAgo(1) },
        actual: { createdAt: daysAgo(46) },
      }),
    );
    const report = await service.getReport('company-1');

    expect(report.modules.budgetActuals.status).toBe('stale');
    expect(report.modules.budgetActuals.daysSinceUpdate).toBe(46);
    // 3 fresh (100 each) + 1 stale (50) averaged = 87.5, rounded to 88.
    expect(report.score).toBe(88);
  });

  it('produces a human-readable warning naming the module and day count for stale data', async () => {
    const service = new DataQualityService(
      fakePrisma({
        movement: { movementDate: daysAgo(30) },
        receivable: { createdAt: daysAgo(1) },
        payable: { createdAt: daysAgo(1) },
        actual: { createdAt: daysAgo(1) },
      }),
    );
    const report = await service.getReport('company-1');

    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain('Bank transactions');
    expect(report.warnings[0]).toContain('30 day(s) ago');
  });
});
