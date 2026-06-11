import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BudgetService } from './budget.service';

@ApiTags('Budget')
@Controller('budget')
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get(':companyId/vs-actual')
  @ApiOperation({ summary: 'Budget vs actual variance by category and period' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  getBudgetVsActual(@Param('companyId') companyId: string) {
    return this.budget.getBudgetVsActual(companyId);
  }
}
