import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ForecastCalculationInput, KPI_DEFAULTS, scheduleArApEntries } from '@liqvia2/shared';
import {
  AlertPreviewDto,
  ForecastPreviewDto,
  KpiPreviewDto,
  LiquidityPreviewDto,
} from '../dto/treasury.dto';
import { AlertRulesService } from './alert-rules.service';
import { ForecastCalculationService } from './forecast-calculation.service';
import { LiquidityRiskService } from './liquidity-risk.service';
import { TreasuryEngineService } from './treasury-engine.service';
import { TreasuryKpiService } from './treasury-kpi.service';
import { TreasuryRulesService } from './treasury-rules.service';

@ApiTags('Treasury')
@Controller('treasury')
export class TreasuryController {
  constructor(
    private readonly rules: TreasuryRulesService,
    private readonly liquidity: LiquidityRiskService,
    private readonly kpis: TreasuryKpiService,
    private readonly forecast: ForecastCalculationService,
    private readonly alertRules: AlertRulesService,
    private readonly engine: TreasuryEngineService,
  ) {}

  @Get('rules')
  @ApiOperation({
    summary: 'Approved treasury rules (AR weights, AP priority, liquidity thresholds)',
  })
  getRules() {
    return this.rules.getApprovedRules();
  }

  @Get('kpis/defaults')
  @ApiOperation({ summary: 'Locked KPI calculation constants' })
  getKpiDefaults() {
    return KPI_DEFAULTS;
  }

  @Post('kpis/preview')
  @ApiOperation({ summary: 'Calculate full KPI dashboard snapshot from raw inputs' })
  previewKpis(@Body() body: KpiPreviewDto) {
    return this.kpis.buildDashboard(body);
  }

  @Post('liquidity/preview')
  @ApiOperation({ summary: 'Calculate runway weeks and liquidity status from cash and burn' })
  previewLiquidity(@Body() body: LiquidityPreviewDto) {
    const runwayWeeks = this.liquidity.calculateRunwayWeeks(body.cash, body.weeklyNetBurn);
    return {
      runwayWeeks,
      liquidityStatus: this.liquidity.classifyLiquidity(runwayWeeks),
    };
  }

  @Post('forecast/preview')
  @ApiOperation({ summary: 'Generate 13-week baseline forecast from AR/AP/cash inputs' })
  previewForecast(@Body() body: ForecastPreviewDto) {
    const input = body as ForecastCalculationInput;
    const forecastLines = this.forecast.calculateBaselineForecast(input);
    const week13 = forecastLines.find((l) => l.weekIndex === 13);
    const weeklyNetBurn = this.kpis.calculateWeeklyNetBurn(
      forecastLines.map((l) => ({
        weekStart: l.weekStart,
        inflows: l.forecastInflows,
        outflows: l.forecastOutflows,
      })),
    );
    const runwayWeeks = this.liquidity.calculateRunwayWeeks(input.openingCash, weeklyNetBurn);
    const liquidityStatus = this.liquidity.resolveLiquidityStatus({
      currentCash: input.openingCash,
      runwayWeeks,
      forecastLines,
    });

    const { arByWeek, apByWeek } = scheduleArApEntries({
      asOfDate: input.asOfDate,
      openingCash: input.openingCash,
      receivables: input.receivables.map((r, index) => ({
        id: `ar-${index}`,
        counterparty: 'Receivable',
        dueDate: r.dueDate ?? r.invoiceDate,
        outstandingAmount: r.outstandingAmount,
      })),
      payables: input.payables.map((p, index) => ({
        id: `ap-${index}`,
        counterparty: 'Payable',
        dueDate: p.dueDate,
        outstandingAmount: p.outstandingAmount,
      })),
    });

    return {
      forecastLines,
      runwayWeeks,
      liquidityStatus,
      week13ClosingCash: week13?.closingCash ?? null,
      arSchedule: arByWeek,
      apSchedule: apByWeek,
    };
  }

  @Get('forecast/:companyId')
  @ApiOperation({ summary: 'Generate forecast from database for a company' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  @ApiQuery({ name: 'persist', required: false, description: 'Set to true to save forecast' })
  getForecast(@Param('companyId') companyId: string, @Query('persist') persist?: string) {
    return this.engine.generateForCompany(companyId, persist === 'true');
  }

  @Post('forecast/:companyId/generate')
  @ApiOperation({ summary: 'Generate and persist baseline forecast for a company' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  generateForecast(@Param('companyId') companyId: string) {
    return this.engine.generateForCompany(companyId, true);
  }

  @Get('forecast/:companyId/stored')
  @ApiOperation({ summary: 'Read the latest persisted baseline forecast' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  getStoredForecast(@Param('companyId') companyId: string) {
    return this.engine.getStoredForecast(companyId);
  }

  @Get('alerts/:companyId')
  @ApiOperation({ summary: 'Evaluate rule-based liquidity alerts for a company' })
  @ApiParam({ name: 'companyId', example: 'cloudpeak-saas' })
  async getAlerts(@Param('companyId') companyId: string) {
    const result = await this.engine.generateForCompany(companyId, false);
    return { alerts: result.alerts, liquidityStatus: result.liquidityStatus };
  }

  @Get('alerts/:companyId/stored')
  @ApiOperation({ summary: 'List unresolved alerts persisted in the database' })
  @ApiParam({ name: 'companyId', example: 'cloudpeak-saas' })
  getStoredAlerts(@Param('companyId') companyId: string) {
    return this.engine.getStoredAlerts(companyId);
  }

  @Post('alerts/preview')
  @ApiOperation({ summary: 'Evaluate alerts from forecast and AR/AP context' })
  previewAlerts(@Body() body: AlertPreviewDto) {
    return {
      alerts: this.alertRules.evaluate(body as Parameters<AlertRulesService['evaluate']>[0]),
    };
  }
}
