/**
 * Liveness and readiness are different questions, and this file exists to keep
 * them different.
 *
 * `GET /health` answers "is the process alive?" and must keep answering `ok`
 * without touching the database — on the RU plane the process is deliberately
 * built to survive an unreachable database (see `PrismaService.onModuleInit`), so
 * a liveness probe that queried Postgres would report the instance dead at
 * exactly the moment it is doing its job.
 *
 * `GET /health/ready` answers the question that actually matters commercially:
 * can this instance store a lead right now? Between 1 and 10 September 2026 the
 * site was down for nine days without anyone noticing, and the monitoring built
 * afterwards is blind to a database outage without this endpoint.
 */
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

function controllerWith(queryRaw: jest.Mock): HealthController {
  return new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);
}

describe('HealthController', () => {
  describe('liveness', () => {
    it('reports ok without touching the database', () => {
      const queryRaw = jest.fn();
      const result = controllerWith(queryRaw).check();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('liqvia2-api');
      // The point of the whole endpoint: no query, ever.
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('reports ready when the database answers', async () => {
      const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

      const result = await controllerWith(queryRaw).ready();

      expect(result.status).toBe('ready');
      expect(result.database).toBe('up');
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('fails with 503 when the database is unreachable', async () => {
      const queryRaw = jest.fn().mockRejectedValue(
        Object.assign(new Error('connect ECONNREFUSED'), { code: 'P1001' }),
      );

      await expect(controllerWith(queryRaw).ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    /**
     * The status code is the contract. An external monitor, Caddy, and any future
     * load balancer all key off it, so a degraded state must never arrive as a
     * `200` carrying a sad-looking body.
     */
    it('signals the failure through the status code, not just the body', async () => {
      const queryRaw = jest.fn().mockRejectedValue(new Error('down'));

      await controllerWith(queryRaw)
        .ready()
        .then(
          () => {
            throw new Error('expected readiness to reject');
          },
          (err: ServiceUnavailableException) => {
            expect(err.getStatus()).toBe(503);
            expect(err.getResponse()).toMatchObject({
              status: 'not_ready',
              database: 'down',
            });
          },
        );
    });

    /**
     * A hanging database must not become a hanging probe. Without the timeout the
     * probe inherits the driver's connection timeout, and the monitor records
     * "timed out" instead of the specific, actionable "database is down".
     */
    it('gives up rather than hanging when the database never answers', async () => {
      jest.useFakeTimers();
      try {
        // Never settles, and never rejects — the exact shape of a hung connection.
        const queryRaw = jest.fn().mockReturnValue(new Promise(() => {}));
        const pending = controllerWith(queryRaw).ready();
        // Assert before advancing, so a probe that resolved early would fail here.
        const settled = jest.fn();
        void pending.then(settled, settled);

        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();

        jest.advanceTimersByTime(5_000);

        await expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
      } finally {
        jest.useRealTimers();
      }
    });

    /**
     * The error class only, never its message. A Prisma connection error can embed
     * the connection string, credentials included — the same rule the lead path
     * follows in `CashOsLeadsService`.
     */
    it('never leaks the underlying error into the response', async () => {
      const secret = 'postgresql://liqvia_app:hunter2@rc1a-abc.mdb.yandexcloud.net:6432/leads';
      const queryRaw = jest.fn().mockRejectedValue(new Error(secret));

      await controllerWith(queryRaw)
        .ready()
        .catch((err: ServiceUnavailableException) => {
          expect(JSON.stringify(err.getResponse())).not.toContain('hunter2');
          expect(JSON.stringify(err.getResponse())).not.toContain('yandexcloud');
        });
    });
  });
});
