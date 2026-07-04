import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, WhyChangedMovement } from '../ai/ai.service';
import { KpiSnapshotService } from './kpi-snapshot.service';
import { buildActualMovements, buildSnapshotMovements, MaterialMovement } from './movement-detection';

export interface WhyChangedResponse {
  hasHistory: boolean;
  movements: MaterialMovement[];
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

@Injectable()
export class WhyChangedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiSnapshot: KpiSnapshotService,
    private readonly aiService: AiService,
  ) {}

  async explain(companyId: string = DEFAULT_DEMO_COMPANY_ID, locale?: string): Promise<WhyChangedResponse> {
    // Best-effort — a failed snapshot write must never break reading the comparison.
    await this.kpiSnapshot.recordSnapshot(companyId).catch(() => undefined);

    const [actuals, currentPoint, previousPoint] = await Promise.all([
      this.prisma.weeklyActual.findMany({
        where: { companyId },
        select: { period: true, category: true, actualAmount: true },
      }),
      this.kpiSnapshot.getCurrentPoint(companyId),
      this.kpiSnapshot.getComparablePoint(companyId),
    ]);

    const hasActualsHistory = new Set(actuals.map((a) => a.period)).size >= 2;
    const hasSnapshotHistory = previousPoint !== null;
    const hasHistory = hasActualsHistory || hasSnapshotHistory;

    const movements: MaterialMovement[] = [
      ...(hasActualsHistory
        ? buildActualMovements(actuals.map((a) => ({ period: a.period, category: a.category, amount: Number(a.actualAmount) })))
        : []),
      ...(previousPoint ? buildSnapshotMovements(currentPoint, previousPoint) : []),
    ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Distinguish "nothing to compare yet" (a brand-new workspace) from "compared,
    // and nothing material changed" — the latter is handled inside generateWhyChanged.
    const result = hasHistory
      ? await this.aiService.generateWhyChanged(companyId, movements.slice(0, 8), locale)
      : {
          text: 'Not enough history yet — check back in a few days once more data has been recorded.',
          model: 'rule-based-no-history',
          source: 'rule_based' as const,
        };

    return { hasHistory, movements, ...result };
  }
}
