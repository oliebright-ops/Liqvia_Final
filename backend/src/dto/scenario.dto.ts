import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScenarioVariablesDto {
  @ApiProperty({ example: 10, description: 'Revenue decline percent (0–100)' })
  revenueDeclinePercent!: number;

  @ApiProperty({ example: 5, description: 'Payroll increase percent (0–100)' })
  payrollIncreasePercent!: number;

  @ApiProperty({ example: 14, description: 'Days to delay receivable collections' })
  receivableDelayDays!: number;

  @ApiProperty({ example: 5, description: 'Non-payroll expense growth percent (0–100)' })
  expenseGrowthPercent!: number;
}

export class CreateScenarioDto {
  @ApiPropertyOptional({ example: 'demo-consulting' })
  companyId?: string;

  @ApiProperty({ example: 'Q3 downturn' })
  name!: string;

  @ApiProperty({ type: ScenarioVariablesDto })
  variables!: ScenarioVariablesDto;
}
