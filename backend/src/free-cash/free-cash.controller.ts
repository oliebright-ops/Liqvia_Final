import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { clampForecastHorizon, DEFAULT_FORECAST_HORIZON } from '@liqvia2/shared';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { FreeCashService } from './free-cash.service';

function parseHorizonWeeks(raw?: string): number {
  if (raw === undefined || raw === '') return DEFAULT_FORECAST_HORIZON;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_FORECAST_HORIZON;
  return clampForecastHorizon(n);
}

@ApiTags('Liquidity')
@Controller('liquidity/free-cash')
@UseGuards(WorkspaceGuard)
export class FreeCashController {
  constructor(private readonly freeCash: FreeCashService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({
    summary: 'Horizon-scoped free available cash (cumulative forecast outflows)',
  })
  @ApiQuery({
    name: 'horizonWeeks',
    required: true,
    description: 'Forecast horizon (1–26 weeks)',
  })
  getReport(@CurrentUser() user: AuthUser, @Query('horizonWeeks') horizonWeeks?: string) {
    return this.freeCash.getReport(user.companyId!, parseHorizonWeeks(horizonWeeks));
  }
}
