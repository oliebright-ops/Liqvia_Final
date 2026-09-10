import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { describeErrorClassForLog } from '../security/log-redaction';

/**
 * How long the readiness probe waits for the database before calling it down.
 *
 * A `SELECT 1` against a healthy database answers in single-digit milliseconds.
 * The point of the ceiling is not to catch a slow query but to stop the probe
 * inheriting the connection timeout: an unreachable host makes the driver hang
 * for far longer than any monitor should wait, and a probe that hangs reads as
 * a timeout rather than as the specific, actionable "database is down".
 */
const READINESS_TIMEOUT_MS = 5_000;

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'API liveness check — does not touch the database' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', service: 'liqvia2-api', aiCfo: 'live' },
    },
  })
  check() {
    return {
      status: 'ok',
      service: 'liqvia2-api',
      // OPENAI_API_KEY is `sync: false` in render.yaml, so it must be set manually in the
      // Render dashboard — if it's unset/expired/invalid, AI CFO silently falls back to
      // rule-based templates for every company with no other operator-visible signal.
      aiCfo: process.env.OPENAI_API_KEY ? 'live' : 'fallback_no_api_key',
    };
  }

  /**
   * Readiness: can this instance actually accept a lead right now?
   *
   * `GET /health` deliberately answers `ok` whenever the process is alive, and on
   * the RU plane the process is *designed* to stay alive when the database is
   * unreachable — see `PrismaService.onModuleInit`, which swallows a failed
   * initial connection so that a visitor gets the Russian retry message instead
   * of a bare `502`. That is the right trade for the visitor, but it leaves a
   * state that looks healthy from outside and in which every submission fails
   * with `503` and every lead the campaign paid for is lost.
   *
   * This endpoint exists so that state is visible. It is the only check that
   * distinguishes "the site is up" from "the site can take a lead".
   *
   * Returning `503` rather than a `200` with a status field is deliberate: the
   * external monitor, Caddy, and any future load balancer all key off the status
   * code, and a body that says `"degraded"` under a `200` is the kind of signal
   * that gets read by a human once and by nothing else ever again.
   */
  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check — verifies the database is reachable',
  })
  @ApiOkResponse({ schema: { example: { status: 'ready', database: 'up' } } })
  @ApiServiceUnavailableResponse({ description: 'The database is not reachable' })
  async ready() {
    const startedAt = Date.now();
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
    } catch (err) {
      // Error class only, never the message: a connection error can embed the
      // connection string, credentials included. Same rule as the lead path.
      this.logger.error(
        `Readiness check failed: ${describeErrorClassForLog(err)}. ` +
          'Lead submissions cannot be stored while this persists.',
      );
      // The message is for an operator reading a monitor, not for a visitor —
      // no visitor ever sees this endpoint — so it names the subsystem plainly
      // while still disclosing nothing about the failure's contents.
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'down',
      });
    }

    return { status: 'ready', database: 'up', latencyMs: Date.now() - startedAt };
  }

  /**
   * Fails the probe rather than inheriting the driver's much longer timeout.
   *
   * The losing promise is not cancellable — Prisma has no abort signal — so the
   * query may still settle after this returns. That is harmless for `SELECT 1`:
   * nothing depends on its result once the race is lost, and a rejection arriving
   * late would otherwise surface as an unhandled rejection, which is why the
   * query's own rejection is swallowed on the timeout path.
   */
  private withTimeout<T>(work: PromiseLike<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Readiness probe timed out')),
        READINESS_TIMEOUT_MS,
      );
      Promise.resolve(work).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error('Readiness probe failed'));
        },
      );
    });
  }
}
