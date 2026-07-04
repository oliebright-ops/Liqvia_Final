import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { CashDrivenService } from './cash-driven.service';

@ApiTags('Cash-Driven Mode')
@Controller('cash-driven')
@UseGuards(WorkspaceGuard)
export class CashDrivenController {
  constructor(private readonly cashDriven: CashDrivenService) {}

  @Get('dashboard')
  @Permissions('treasury:read')
  @ApiOperation({
    summary:
      'Payroll readiness, upcoming obligations, settlement timeline, weekly cash movement, and cash-by-purpose for Cash-Driven Mode companies',
  })
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.cashDriven.getDashboard(user.companyId!);
  }
}
