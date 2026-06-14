import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { clampForecastHorizon } from '@liqvia2/shared';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { DashboardService } from './dashboard.service';

function parseHorizonWeeks(raw?: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return clampForecastHorizon(n);
}

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @UseGuards(WorkspaceGuard)
  @Permissions('treasury:read')
  @ApiOperation({
    summary: 'Executive dashboard for the authenticated user’s company',
  })
  @ApiQuery({
    name: 'horizonWeeks',
    required: false,
    description: 'Forecast horizon override (1–26 weeks) for liquidity KPIs',
  })
  getMine(@CurrentUser() user: AuthUser, @Query('horizonWeeks') horizonWeeks?: string) {
    return this.dashboard.getDashboard(user.companyId!, parseHorizonWeeks(horizonWeeks));
  }

  @Get(':companyId')
  @UseGuards(WorkspaceGuard)
  @Permissions('treasury:read')
  @ApiOperation({
    summary: 'Executive dashboard aggregate (KPIs, forecast, alerts, budget vs actual)',
  })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  @ApiQuery({
    name: 'horizonWeeks',
    required: false,
    description: 'Forecast horizon override (1–26 weeks) for liquidity KPIs',
  })
  get(@Param('companyId') companyId: string, @Query('horizonWeeks') horizonWeeks?: string) {
    return this.dashboard.getDashboard(companyId, parseHorizonWeeks(horizonWeeks));
  }
}
