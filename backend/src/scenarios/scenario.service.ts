import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_DEMO_COMPANY_ID,
  ScenarioVariables,
  WeeklyForecastLine,
  applyScenarioToInput,
  normalizeScenarioVariables,
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

export interface ScenarioListItem {
  id: string;
  name: string;
  createdAt: string;
  variables: ScenarioVariables;
  week13ClosingCash: number | null;
  deltaWeek13ClosingCash: number | null;
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

  async listScenarios(companyId: string = DEFAULT_DEMO_COMPANY_ID): Promise<ScenarioListItem[]> {
    const scenarios = await this.prisma.scenario.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { lines: { where: { weekIndex: 13 }, take: 1 } },
    });

    const baselineInput = await this.engine.getForecastInput(companyId);
    const baselineLines = this.forecast.calculateBaselineForecast(baselineInput);
    const baselineW13 = baselineLines.find((l) => l.weekIndex === 13)?.closingCash ?? null;

    return scenarios.map((s) => {
      const w13 = s.lines[0] ? Number(s.lines[0].closingCash) : null;
      const variables = scenarioVariablesFromRecord(s);
      return {
        id: s.id,
        name: s.name,
        createdAt: s.createdAt.toISOString(),
        variables,
        week13ClosingCash: w13,
        deltaWeek13ClosingCash:
          baselineW13 !== null && w13 !== null ? round2(w13 - baselineW13) : null,
      };
    });
  }

  async previewScenario(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    variables: Partial<ScenarioVariables>,
  ): Promise<ScenarioComparison> {
    return this.runComparison(companyId, {
      scenarioId: 'preview',
      name: 'Preview',
      variables: normalizeScenarioVariables(variables),
    });
  }

  async createScenario(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    name: string,
    variables: Partial<ScenarioVariables>,
  ) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const normalized = normalizeScenarioVariables(variables);
    const scenario = await this.prisma.scenario.create({
      data: scenarioVariablesToRecord(companyId, name, normalized),
    });

    await this.recalculateScenario(scenario.id);
    return scenario;
  }

  async recalculateScenario(scenarioId: string): Promise<ScenarioComparison> {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Scenario not found');

    const variables = scenarioVariablesFromRecord(scenario);
    const comparison = await this.runComparison(scenario.companyId, {
      scenarioId,
      name: scenario.name,
      variables,
    });

    await this.prisma.scenarioLine.deleteMany({ where: { scenarioId } });
    await this.prisma.scenarioLine.createMany({
      data: comparison.scenario.lines.map((l) => ({
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

    return comparison;
  }

  private async runComparison(
    companyId: string,
    meta: { scenarioId: string; name: string; variables: ScenarioVariables },
  ): Promise<ScenarioComparison> {
    const baselineInput = await this.engine.getForecastInput(companyId);
    const scenarioInput = applyScenarioToInput(baselineInput, meta.variables);

    const baselineLines = this.forecast.calculateBaselineForecast(baselineInput);
    const scenarioLines = this.forecast.calculateBaselineForecast(scenarioInput);

    const baseline = this.summarize(baselineLines, baselineInput.openingCash);
    const scenarioSummary = this.summarize(scenarioLines, scenarioInput.openingCash);

    return {
      scenarioId: meta.scenarioId,
      name: meta.name,
      variables: meta.variables,
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

function scenarioVariablesFromRecord(record: {
  revenueDeclinePercent: unknown;
  revenueGrowthPercent?: unknown;
  payrollIncreasePercent: unknown;
  receivableDelayDays: number;
  payableDelayDays?: number;
  expenseGrowthPercent: unknown;
  taxIncreasePercent?: unknown;
  oneOffInflowAmount?: unknown;
  oneOffInflowWeek?: number;
  oneOffOutflowAmount?: unknown;
  oneOffOutflowWeek?: number;
}): ScenarioVariables {
  return normalizeScenarioVariables({
    revenueDeclinePercent: Number(record.revenueDeclinePercent),
    revenueGrowthPercent: Number(record.revenueGrowthPercent ?? 0),
    payrollIncreasePercent: Number(record.payrollIncreasePercent),
    receivableDelayDays: record.receivableDelayDays,
    payableDelayDays: record.payableDelayDays ?? 0,
    expenseGrowthPercent: Number(record.expenseGrowthPercent),
    taxIncreasePercent: Number(record.taxIncreasePercent ?? 0),
    oneOffInflowAmount: Number(record.oneOffInflowAmount ?? 0),
    oneOffInflowWeek: record.oneOffInflowWeek ?? 1,
    oneOffOutflowAmount: Number(record.oneOffOutflowAmount ?? 0),
    oneOffOutflowWeek: record.oneOffOutflowWeek ?? 1,
  });
}

function scenarioVariablesToRecord(
  companyId: string,
  name: string,
  variables: ScenarioVariables,
) {
  return {
    companyId,
    name,
    revenueDeclinePercent: variables.revenueDeclinePercent,
    revenueGrowthPercent: variables.revenueGrowthPercent,
    payrollIncreasePercent: variables.payrollIncreasePercent,
    receivableDelayDays: variables.receivableDelayDays,
    payableDelayDays: variables.payableDelayDays,
    expenseGrowthPercent: variables.expenseGrowthPercent,
    taxIncreasePercent: variables.taxIncreasePercent,
    oneOffInflowAmount: variables.oneOffInflowAmount,
    oneOffInflowWeek: variables.oneOffInflowWeek,
    oneOffOutflowAmount: variables.oneOffOutflowAmount,
    oneOffOutflowWeek: variables.oneOffOutflowWeek,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
