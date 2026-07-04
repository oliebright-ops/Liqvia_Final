import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { BusinessPulseService } from './business-pulse.service';

@ApiTags('Business Pulse')
@Controller('business-pulse')
@UseGuards(WorkspaceGuard)
export class BusinessPulseController {
  constructor(private readonly businessPulse: BusinessPulseService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Top-5 ranked urgency items + plain-English daily briefing' })
  get(@CurrentUser() user: AuthUser, @Query('locale') locale?: string) {
    return this.businessPulse.getPulse(user.companyId!, locale);
  }
}
