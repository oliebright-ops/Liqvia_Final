import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LiquidityPreviewDto {
  @ApiProperty({ example: 50000 })
  cash!: number;

  @ApiProperty({ example: 12000 })
  weeklyNetBurn!: number;
}

export class ForecastReceivableDto {
  @ApiProperty({ example: 15000 })
  outstandingAmount!: number;

  @ApiProperty({ example: '2026-05-15' })
  invoiceDate!: string;
}

export class ForecastPayableDto {
  @ApiProperty({ example: 22000 })
  outstandingAmount!: number;

  @ApiProperty({ example: '2026-06-05' })
  dueDate!: string;

  @ApiProperty({ example: 'payroll' })
  supplierPriority!: string;
}

export class ForecastPreviewDto {
  @ApiProperty({ example: '2026-06-01' })
  asOfDate!: string;

  @ApiProperty({ example: 60500 })
  openingCash!: number;

  @ApiProperty({ type: [ForecastReceivableDto] })
  receivables!: ForecastReceivableDto[];

  @ApiProperty({ type: [ForecastPayableDto] })
  payables!: ForecastPayableDto[];
}

export class AlertPreviewDto {
  @ApiProperty({ description: '13-week forecast lines with closing cash per week' })
  forecastLines!: Array<{ weekIndex: number; closingCash: number; liquidityStatus: string }>;

  @ApiProperty({ example: 15000 })
  overdueReceivables!: number;

  @ApiProperty({ example: 22000 })
  upcomingPayables!: number;

  @ApiPropertyOptional({ example: 6 })
  runwayWeeks!: number | null;

  @ApiProperty({ example: 'high_risk' })
  liquidityStatus!: string;
}

export class KpiPreviewDto {
  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: '2026-06-01' })
  asOfDate!: string;

  @ApiProperty()
  bankBalances!: Array<{ balance: number; balanceDate: string }>;

  @ApiProperty()
  forecastLines!: Array<{ weekIndex: number; closingCash: number }>;

  @ApiProperty()
  weeklyCashFlows!: Array<{ weekStart: string; inflows: number; outflows: number }>;

  @ApiProperty()
  receivables!: Array<{ outstandingAmount: number; invoiceDate: string; dueDate: string }>;

  @ApiProperty()
  payables!: Array<{ outstandingAmount: number; billDate: string; dueDate: string }>;

  @ApiProperty()
  budgetActuals!: Array<{
    period: string;
    category: string;
    budgetAmount: number;
    actualAmount: number;
  }>;

  @ApiPropertyOptional()
  actualCashForForecastVariance?: number;
}
