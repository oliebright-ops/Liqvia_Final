import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { BudgetService } from './budget.service';

@ApiTags('Budget')
@Controller('budget')
@UseGuards(WorkspaceGuard)
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get('vs-actual')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Budget vs actual variance for the active company' })
  getMine(@CurrentUser() user: AuthUser) {
    return this.budget.getBudgetVsActual(user.companyId!);
  }

  @Get(':companyId/vs-actual')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Budget vs actual variance by category and period' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  getBudgetVsActual(@Param('companyId') companyId: string) {
    return this.budget.getBudgetVsActual(companyId);
  }
}
