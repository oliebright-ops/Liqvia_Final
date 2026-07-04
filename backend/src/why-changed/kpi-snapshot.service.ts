import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { TreasuryKpiService } from '../treasury/treasury-kpi.service';
import { FreeCashService } from '../free-cash/free-cash.service';
import { KpiPoint } from './movement-detection';

/** How far back a snapshot must be to count as a meaningful "previous period" —
 * short of a full week, day-to-day noise would dominate the comparison. */
const MIN_COMPARISON_DAYS_AGO = 6;

@Injectable()
export class KpiSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treasuryEngine: TreasuryEngineService,
    private readonly kpis: TreasuryKpiService,
    private readonly freeCash: FreeCashService,
  ) {}

  /** Upserts today's snapshot — safe to call on every read, idempotent per company/day. */
  async recordSnapshot(companyId: string = DEFAULT_DEMO_COMPANY_ID): Promise<void> {
    const [engineResult, freeCashReport] = await Promise.all([
      this.treasuryEngine.generateForCompany(companyId, false),
      this.freeCash.getReport(companyId, 13),
    ]);

    const overdueReceivables = this.kpis.calculateOverdueReceivables(
      engineResult.rawData.receivables,
      engineResult.asOfDate,
    );
    const upcomingPayables = this.kpis.calculateUpcomingPayables(
      engineResult.rawData.payables,
      engineResult.asOfDate,
    );

    const asOfDate = new Date(`${engineResult.asOfDate}T00:00:00.000Z`);
    const data = {
      currentCash: engineResult.openingCash,
      runwayWeeks: engineResult.runwayWeeks,
      overdueReceivables,
      upcomingPayables,
      freeAvailableCash: freeCashReport.freeAvailableCash,
      liquidityStatus: engineResult.liquidityStatus,
    };

    await this.prisma.kpiSnapshot.upsert({
      where: { companyId_asOfDate: { companyId, asOfDate } },
      create: { companyId, asOfDate, ...data },
      update: data,
    });
  }

  /** The current live KPI position, in the same shape as a stored snapshot. */
  async getCurrentPoint(companyId: string = DEFAULT_DEMO_COMPANY_ID): Promise<KpiPoint> {
    const [engineResult, freeCashReport] = await Promise.all([
      this.treasuryEngine.generateForCompany(companyId, false),
      this.freeCash.getReport(companyId, 13),
    ]);

    return {
      asOfDate: engineResult.asOfDate,
      currentCash: engineResult.openingCash,
      runwayWeeks: engineResult.runwayWeeks,
      overdueReceivables: this.kpis.calculateOverdueReceivables(
        engineResult.rawData.receivables,
        engineResult.asOfDate,
      ),
      upcomingPayables: this.kpis.calculateUpcomingPayables(
        engineResult.rawData.payables,
        engineResult.asOfDate,
      ),
      freeAvailableCash: freeCashReport.freeAvailableCash,
    };
  }

  /** The most recent snapshot at least MIN_COMPARISON_DAYS_AGO old, or null if none
   * exists yet — a brand-new workspace has no history until a few days of usage. */
  async getComparablePoint(companyId: string = DEFAULT_DEMO_COMPANY_ID): Promise<KpiPoint | null> {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - MIN_COMPARISON_DAYS_AGO);

    const snapshot = await this.prisma.kpiSnapshot.findFirst({
      where: { companyId, asOfDate: { lte: cutoff } },
      orderBy: { asOfDate: 'desc' },
    });
    if (!snapshot) return null;

    return {
      asOfDate: snapshot.asOfDate.toISOString().slice(0, 10),
      currentCash: Number(snapshot.currentCash),
      runwayWeeks: snapshot.runwayWeeks === null ? null : Number(snapshot.runwayWeeks),
      overdueReceivables: Number(snapshot.overdueReceivables),
      upcomingPayables: Number(snapshot.upcomingPayables),
      freeAvailableCash: Number(snapshot.freeAvailableCash),
    };
  }
}
