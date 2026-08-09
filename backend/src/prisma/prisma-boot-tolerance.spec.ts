/**
 * A database that is down at boot must not turn into a bare gateway error for a
 * Russian visitor who has just filled in the lead form.
 */
import { PrismaService } from './prisma.service';

describe('PrismaService.onModuleInit', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  it('rethrows on the global plane — a DB down at boot is a deployment failure there', async () => {
    delete process.env.LIQVIA_DATA_PLANE;
    const svc = new PrismaService();
    jest.spyOn(svc, '$connect').mockRejectedValue(new Error('P1001 cannot reach database'));

    await expect(svc.onModuleInit()).rejects.toThrow(/cannot reach database/);
  });

  it('starts anyway on the RU plane so the endpoint can return its own 503', async () => {
    process.env.LIQVIA_DATA_PLANE = 'ru';
    const svc = new PrismaService();
    jest.spyOn(svc, '$connect').mockRejectedValue(new Error('P1001 cannot reach database'));

    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });

  it('logs the error class only, never the connection string', async () => {
    process.env.LIQVIA_DATA_PLANE = 'ru';
    const svc = new PrismaService();
    const secret = 'postgresql://liqvia_app:hunter2@rc1a-x.mdb.yandexcloud.net:6432/liqvia_ru';
    jest.spyOn(svc, '$connect').mockRejectedValue(new Error(`P1001 connecting to ${secret}`));

    const captured: string[] = [];
    jest
      .spyOn((svc as unknown as { logger: { error: (m: string) => void } }).logger, 'error')
      .mockImplementation((m: string) => void captured.push(m));

    await svc.onModuleInit();

    const all = captured.join('\n');
    expect(all).not.toContain('hunter2');
    expect(all).not.toContain('postgresql://');
    expect(all).toContain('No data is written');
  });
});
