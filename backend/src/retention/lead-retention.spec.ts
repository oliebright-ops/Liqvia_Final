/**
 * Retention of landing-page leads.
 *
 * The tests that matter here are the ones about what retention must NOT do:
 * destroy consent evidence, wait out the month when consent has been withdrawn,
 * or write a person's details into a log line while erasing them.
 */
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ERASED_PLACEHOLDER,
  LEAD_RETENTION_DAYS,
  LeadRetentionService,
} from './lead-retention.service';

const NOW = new Date('2026-09-15T12:00:00.000Z');

/** The shape of the `updateMany` argument these tests assert against. */
interface UpdateManyCall {
  where: { id?: string; anonymisedAt?: Date | null; createdAt?: { lt: Date } };
  data: Record<string, unknown>;
}

const callArg = (mock: jest.Mock, index = 0): UpdateManyCall =>
  mock.mock.calls[index][0] as UpdateManyCall;

function build(updateMany = jest.fn(async () => ({ count: 0 }))) {
  const consentRecord = { updateMany: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() };
  const prisma = {
    cashOsLead: { updateMany },
    consentRecord,
  } as unknown as PrismaService;
  return { service: new LeadRetentionService(prisma), updateMany, consentRecord };
}

describe('retention window', () => {
  it('is a one-month ceiling', () => {
    expect(LEAD_RETENTION_DAYS).toBe(30);
  });

  it('erases leads older than the ceiling, and only those', async () => {
    const { service, updateMany } = build();
    await service.sweep(NOW);

    const where = callArg(updateMany).where;
    expect(where.createdAt?.lt).toEqual(new Date('2026-08-16T12:00:00.000Z'));
    // Already-erased rows are excluded, so the sweep is idempotent.
    expect(where.anonymisedAt).toBeNull();
  });
});

describe('erasure overwrites every identifying column', () => {
  it('clears name, email, company, role, phone, comment and firmographics', async () => {
    const { service, updateMany } = build();
    await service.sweep(NOW);

    const data = callArg(updateMany).data;
    expect(data.name).toBe(ERASED_PLACEHOLDER);
    expect(data.email).toBe(ERASED_PLACEHOLDER);
    // A sole trader's company name identifies the individual behind it.
    expect(data.companyName).toBe(ERASED_PLACEHOLDER);
    expect(data.role).toBeNull();
    expect(data.phone).toBeNull();
    expect(data.comment).toBeNull();
    expect(data.employeeCount).toBeNull();
    expect(data.industry).toBeNull();
    expect(data.anonymisedAt).toEqual(NOW);
    expect(data.anonymisedReason).toBe('retention-expiry');
  });

  it('keeps the campaign tag and timestamp, which identify nobody', async () => {
    const { service, updateMany } = build();
    await service.sweep(NOW);

    const data = callArg(updateMany).data;
    expect(data).not.toHaveProperty('source');
    expect(data).not.toHaveProperty('createdAt');
  });
});

describe('consent evidence survives retention', () => {
  it('never touches ConsentRecord during a sweep', async () => {
    const { service, consentRecord } = build();
    await service.sweep(NOW);

    expect(consentRecord.deleteMany).not.toHaveBeenCalled();
    expect(consentRecord.delete).not.toHaveBeenCalled();
    expect(consentRecord.updateMany).not.toHaveBeenCalled();
  });

  it('erases the lead by overwriting rather than deleting, so nothing cascades', async () => {
    const { service, updateMany } = build();
    await service.sweep(NOW);

    // `updateMany`, never `deleteMany`. A delete would take the consent evidence
    // with it and destroy the proof that collecting the lead was lawful.
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('erasure before the ceiling', () => {
  it.each([
    ['consent-withdrawn'],
    ['subject-request'],
    ['purpose-ended'],
  ] as const)('erases immediately on %s, without waiting for the month', async (reason) => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const { service } = build(updateMany);

    await expect(service.eraseLead('lead-1', reason, NOW)).resolves.toBe(true);

    const call = callArg(updateMany);
    expect(call.where.id).toBe('lead-1');
    expect(call.where.createdAt).toBeUndefined(); // age is irrelevant here
    expect(call.data.anonymisedReason).toBe(reason);
  });

  it('is not an error when the same withdrawal is processed twice', async () => {
    const updateMany = jest.fn(async () => ({ count: 0 }));
    const { service } = build(updateMany);

    await expect(service.eraseLead('lead-1', 'consent-withdrawn', NOW)).resolves.toBe(false);
  });
});

describe('deletion logging', () => {
  const captured: string[] = [];
  let spies: jest.SpyInstance[] = [];

  beforeEach(() => {
    captured.length = 0;
    const collect = (...args: unknown[]) => void captured.push(args.map(String).join(' '));
    spies = (['log', 'warn', 'error'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(collect),
    );
  });
  afterEach(() => spies.forEach((s) => s.mockRestore()));

  it('logs counts and reasons, never the data being erased', async () => {
    const { service } = build(jest.fn(async () => ({ count: 3 })));
    await service.sweep(NOW);

    const all = captured.join('\n');
    expect(all).toContain('erased 3 lead(s)');
    expect(all).not.toMatch(/@/); // no email
    expect(all).not.toMatch(/\+?\d{7,}/); // no phone
  });

  it('logs the internal lead id for a targeted erasure, which is not personal data', async () => {
    const { service } = build(jest.fn(async () => ({ count: 1 })));
    await service.eraseLead('lead-42', 'consent-withdrawn', NOW);

    expect(captured.join('\n')).toContain('lead-42');
    expect(captured.join('\n')).toContain('Consent evidence retained');
  });

  it('logs only the error class when a sweep fails', async () => {
    const failing = jest.fn(async () => {
      throw new Error('cashOsLead.updateMany failed for { name: "Иван Петров" }');
    });
    const { service } = build(failing);

    await expect(service.sweep(NOW)).rejects.toThrow();
    expect(captured.join('\n')).not.toContain('Иван Петров');
    expect(captured.join('\n')).toContain('Retention sweep failed: Error');
  });
});
