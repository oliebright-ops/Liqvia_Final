import { Injectable } from '@nestjs/common';
import { LIQUIDITY_THRESHOLDS, LiquidityStatus } from '@liqvia2/shared';

export interface WeeklyCashFlowSlice {
  inflows: number;
  outflows: number;
}

export interface ForecastClosingSlice {
  weekIndex: number;
  closingCash: number;
}

export interface LiquidityAssessmentInput {
  currentCash: number;
  runwayWeeks: number | null;
  forecastLines: ForecastClosingSlice[];
}

const STATUS_SEVERITY: Record<LiquidityStatus, number> = {
  healthy: 0,
  moderate: 1,
  high_risk: 2,
  critical: 3,
};

@Injectable()
export class LiquidityRiskService {
  /** Runway in weeks = cash / weeklyNetBurn */
  calculateRunwayWeeks(cash: number, weeklyNetBurn: number): number | null {
    if (weeklyNetBurn <= 0) return null;
    if (cash <= 0) return 0;
    return cash / weeklyNetBurn;
  }

  /**
   * Average positive weekly net outflow.
   * Matches TreasuryKpiService.calculateWeeklyNetBurn semantics.
   */
  averageWeeklyNetBurn(weeks: WeeklyCashFlowSlice[]): number {
    const burns = weeks.map((w) => w.outflows - w.inflows).filter((b) => b > 0);
    if (burns.length === 0) return 0;
    return burns.reduce((sum, b) => sum + b, 0) / burns.length;
  }

  /** Runway-based score only (see treasury-rules-engine.md thresholds). */
  classifyLiquidity(runwayWeeks: number | null): LiquidityStatus {
    if (runwayWeeks === null) return 'healthy';
    if (runwayWeeks <= 0) return 'critical';
    if (runwayWeeks > LIQUIDITY_THRESHOLDS.healthyMinWeeks) return 'healthy';
    if (runwayWeeks >= LIQUIDITY_THRESHOLDS.moderateMinWeeks) return 'moderate';
    if (runwayWeeks >= LIQUIDITY_THRESHOLDS.highRiskMinWeeks) return 'high_risk';
    return 'critical';
  }

  /** Per-week status from projected closing cash and forward runway. */
  classifyWeekLiquidity(closingCash: number, runwayWeeks: number | null): LiquidityStatus {
    if (closingCash < 0) return 'critical';
    return this.classifyLiquidity(runwayWeeks);
  }

  /**
   * Executive liquidity status: worst of runway score and 13-week cash projection stress.
   */
  resolveLiquidityStatus(input: LiquidityAssessmentInput): LiquidityStatus {
    const candidates: LiquidityStatus[] = [this.classifyLiquidity(input.runwayWeeks)];

    if (input.currentCash < 0) {
      candidates.push('critical');
    }

    const negativeWeeks = input.forecastLines.filter((l) => l.closingCash < 0);
    if (negativeWeeks.length > 0) {
      const firstNegativeWeek = Math.min(...negativeWeeks.map((l) => l.weekIndex));
      candidates.push(firstNegativeWeek <= 4 ? 'critical' : 'high_risk');
    }

    const week13 = input.forecastLines.find((l) => l.weekIndex === 13);
    if (week13 && week13.closingCash < 0) {
      candidates.push('critical');
    }

    return candidates.reduce((worst, status) =>
      STATUS_SEVERITY[status] > STATUS_SEVERITY[worst] ? status : worst,
    );
  }
}
