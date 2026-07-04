import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { DataQualityService } from './data-quality.service';

@ApiTags('Data Quality')
@Controller('data-quality')
@UseGuards(WorkspaceGuard)
export class DataQualityController {
  constructor(private readonly dataQuality: DataQualityService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Per-module data freshness score for the current company' })
  get(@CurrentUser() user: AuthUser) {
    return this.dataQuality.getReport(user.companyId!);
  }

  @Get('confidence')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Explainable forecast confidence checklist (strengths/weaknesses/fixes)' })
  getConfidence(@CurrentUser() user: AuthUser) {
    return this.dataQuality.getConfidenceReport(user.companyId!);
  }
}
