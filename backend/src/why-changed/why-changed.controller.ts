import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { WhyChangedService } from './why-changed.service';

@ApiTags('Why Changed')
@Controller('why-changed')
@UseGuards(WorkspaceGuard)
export class WhyChangedController {
  constructor(private readonly whyChanged: WhyChangedService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Plain-English explanation of material period-over-period movements' })
  get(@CurrentUser() user: AuthUser, @Query('locale') locale?: string) {
    return this.whyChanged.explain(user.companyId!, locale);
  }
}
