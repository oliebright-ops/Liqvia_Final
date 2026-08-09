import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isRuDataPlane } from '../residency/data-plane';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Connects at startup, but on the RU plane does not make a reachable database a
   * precondition for the process existing.
   *
   * On the global deployment a database that is down at boot is a deployment
   * failure, and failing fast is right. On the RU lead plane it produces a worse
   * outcome than the failure it reports: the process never starts, so the reverse
   * proxy answers with a bare `502`, and a Russian visitor who has just filled in
   * the form sees a blank gateway error instead of «попробуйте ещё раз». They do
   * not resend. The enquiry the campaign paid for is lost silently.
   *
   * Staying up lets the lead endpoint return its own `503` with the Russian retry
   * message — which is the behaviour the fail-closed design already implements for
   * a database that fails *while* the app is running. This makes the two cases
   * behave the same way from the visitor's point of view.
   *
   * Residency is unaffected: no query succeeds while the database is unreachable,
   * nothing is written anywhere, and there is still no fallback.
   */
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      if (!isRuDataPlane()) throw err;

      // Error class only — a connection error can carry the connection string.
      this.logger.error(
        `Initial database connection failed on the RU data plane: ` +
          `${err instanceof Error ? err.name : '[non-error thrown]'}. ` +
          'Starting anyway so lead submissions can fail closed with a usable ' +
          'message rather than a bare gateway error. No data is written while ' +
          'the database is unreachable.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
