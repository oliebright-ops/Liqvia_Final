import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_DEMO_COMPANY_ID,
  ScenarioVariables,
  WeeklyForecastLine,
  applyScenarioToInput,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastCalculationService } from '../treasury/forecast-calculation.service';
import { LiquidityRiskService } from '../treasury/liquidity-risk.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { TreasuryKpiService } from '../treasury/treasury-kpi.service';

export interface ScenarioComparison {
  scenarioId: string;
  name: string;
  variables: ScenarioVariables;
  baseline: ForecastSummary;
  scenario: ForecastSummary;
  delta: {
    week13ClosingCash: number | null;
    runwayWeeks: number | null;
  };
}

interface ForecastSummary {
  lines: WeeklyForecastLine[];
  week13ClosingCash: number | null;
  runwayWeeks: number | null;
  liquidityStatus: string;
}

@Injectable()
export class ScenarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: TreasuryEngineService,
    private readonly forecast: ForecastCalculationService,
    private readonly liquidity: LiquidityRiskService,
    private readonly kpis: TreasuryKpiService,
  ) {}

  async listScenarios(companyId: string = DEFAULT_DEMO_COMPANY_ID) {
    return this.prisma.scenario.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createScenario(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    name: string,
    variables: ScenarioVariables,
  ) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const scenario = await this.prisma.scenario.create({
      data: {
        companyId,
        name,
        revenueDeclinePercent: variables.revenueDeclinePercent,
        payrollIncreasePercent: variables.payrollIncreasePercent,
        receivableDelayDays: variables.receivableDelayDays,
        expenseGrowthPercent: variables.expenseGrowthPercent,
      },
    });

    await this.recalculateScenario(scenario.id);
    return scenario;
  }

  async recalculateScenario(scenarioId: string): Promise<ScenarioComparison> {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Scenario not found');

    const variables: ScenarioVariables = {
      revenueDeclinePercent: Number(scenario.revenueDeclinePercent),
      payrollIncreasePercent: Number(scenario.payrollIncreasePercent),
      receivableDelayDays: scenario.receivableDelayDays,
      expenseGrowthPercent: Number(scenario.expenseGrowthPercent),
    };

    const baselineInput = await this.engine.getForecastInput(scenario.companyId);
    const scenarioInput = applyScenarioToInput(baselineInput, variables);

    const baselineLines = this.forecast.calculateBaselineForecast(baselineInput);
    const scenarioLines = this.forecast.calculateBaselineForecast(scenarioInput);

    await this.prisma.scenarioLine.deleteMany({ where: { scenarioId } });
    await this.prisma.scenarioLine.createMany({
      data: scenarioLines.map((l) => ({
        scenarioId,
        weekIndex: l.weekIndex,
        weekStart: new Date(l.weekStart),
        openingCash: l.openingCash,
        forecastInflows: l.forecastInflows,
        forecastOutflows: l.forecastOutflows,
        closingCash: l.closingCash,
        liquidityStatus: l.liquidityStatus,
      })),
    });

    const baseline = this.summarize(baselineLines, baselineInput.openingCash);
    const scenarioSummary = this.summarize(scenarioLines, scenarioInput.openingCash);

    return {
      scenarioId,
      name: scenario.name,
      variables,
      baseline,
      scenario: scenarioSummary,
      delta: {
        week13ClosingCash:
          baseline.week13ClosingCash !== null && scenarioSummary.week13ClosingCash !== null
            ? round2(scenarioSummary.week13ClosingCash - baseline.week13ClosingCash)
            : null,
        runwayWeeks:
          baseline.runwayWeeks !== null && scenarioSummary.runwayWeeks !== null
            ? round2(scenarioSummary.runwayWeeks - baseline.runwayWeeks)
            : null,
      },
    };
  }

  private summarize(lines: WeeklyForecastLine[], openingCash: number): ForecastSummary {
    const week13 = lines.find((l) => l.weekIndex === 13);
    const weeklyNetBurn = this.kpis.calculateWeeklyNetBurn(
      lines.map((l) => ({
        weekStart: l.weekStart,
        inflows: l.forecastInflows,
        outflows: l.forecastOutflows,
      })),
    );
    const runwayWeeks = this.liquidity.calculateRunwayWeeks(openingCash, weeklyNetBurn);
    return {
      lines,
      week13ClosingCash: week13?.closingCash ?? null,
      runwayWeeks: runwayWeeks === null ? null : round2(runwayWeeks),
      liquidityStatus: this.liquidity.resolveLiquidityStatus({
        currentCash: openingCash,
        runwayWeeks,
        forecastLines: lines,
      }),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
