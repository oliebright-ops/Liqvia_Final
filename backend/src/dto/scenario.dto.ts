import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScenarioVariablesDto {
  @ApiPropertyOptional({ example: 10, description: 'Revenue decline percent (0–100)' })
  revenueDeclinePercent?: number;

  @ApiPropertyOptional({ example: 5, description: 'Revenue growth percent (0–50)' })
  revenueGrowthPercent?: number;

  @ApiPropertyOptional({ example: 5, description: 'Payroll increase percent (0–100)' })
  payrollIncreasePercent?: number;

  @ApiPropertyOptional({ example: 14, description: 'Days to delay receivable collections' })
  receivableDelayDays?: number;

  @ApiPropertyOptional({ example: 7, description: 'Days to defer payable due dates' })
  payableDelayDays?: number;

  @ApiPropertyOptional({ example: 5, description: 'Non-payroll expense growth percent (0–100)' })
  expenseGrowthPercent?: number;

  @ApiPropertyOptional({ example: 10, description: 'Tax payable increase percent (0–100)' })
  taxIncreasePercent?: number;

  @ApiPropertyOptional({ example: 50000, description: 'One-off cash inflow amount' })
  oneOffInflowAmount?: number;

  @ApiPropertyOptional({ example: 2, description: 'Week index (1–13) for one-off inflow' })
  oneOffInflowWeek?: number;

  @ApiPropertyOptional({ example: 75000, description: 'One-off cash outflow amount' })
  oneOffOutflowAmount?: number;

  @ApiPropertyOptional({ example: 4, description: 'Week index (1–13) for one-off outflow' })
  oneOffOutflowWeek?: number;
}

export class CreateScenarioDto {
  @ApiPropertyOptional({ example: 'demo-consulting' })
  companyId?: string;

  @ApiProperty({ example: 'Q3 downturn' })
  name!: string;

  @ApiProperty({ type: ScenarioVariablesDto })
  variables!: ScenarioVariablesDto;
}

export class PreviewScenarioDto {
  @ApiProperty({ type: ScenarioVariablesDto })
  variables!: ScenarioVariablesDto;
}
