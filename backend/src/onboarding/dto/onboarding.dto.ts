import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardingCompanyDto {
  @ApiProperty({ example: 'Acme Construction Ltd' })
  name!: string;

  @ApiProperty({ example: 'Construction' })
  industry!: string;

  @ApiProperty({ example: 'GBP' })
  currency!: string;

  @ApiProperty({ example: 1, description: 'Fiscal year start month (1–12)' })
  fiscalYearStart!: number;

  @ApiProperty({ example: 13 })
  forecastHorizonWeeks!: number;

  @ApiProperty({ example: 500000 })
  openingCashBalance!: number;

  @ApiPropertyOptional({ example: 'en' })
  locale?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Operating Account' },
        accountNumberMasked: { type: 'string', example: '****1234' },
        currency: { type: 'string', example: 'GBP' },
        openingBalance: { type: 'number', example: 250000 },
      },
    },
  })
  bankAccounts?: OnboardingBankAccountDto[];

  @ApiPropertyOptional({ enum: ['invoice_driven', 'cash_driven', 'mixed'], example: 'invoice_driven' })
  businessMode?: 'invoice_driven' | 'cash_driven' | 'mixed';
}

export class OnboardingBankAccountDto {
  @ApiProperty({ example: 'Operating Account' })
  name!: string;

  @ApiPropertyOptional({ example: '****1234' })
  accountNumberMasked?: string;

  @ApiPropertyOptional({ example: 'GBP' })
  currency?: string;

  @ApiProperty({ example: 250000 })
  openingBalance!: number;
}

export class OnboardingTeamMemberDto {
  @ApiProperty({ example: 'Alex Analyst' })
  name!: string;

  @ApiProperty({ example: 'alex@acme.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'MemberPass123!' })
  password?: string;

  @ApiProperty({ enum: ['member', 'viewer', 'admin', 'uploader'], example: 'member' })
  role!: 'member' | 'viewer' | 'admin' | 'uploader';
}

export class OnboardingCreateCompanyDto {
  @ApiProperty({ type: OnboardingCompanyDto })
  company!: OnboardingCompanyDto;

  @ApiPropertyOptional({ type: [OnboardingTeamMemberDto] })
  teamMembers?: OnboardingTeamMemberDto[];
}

export class DemoModeDto {
  @ApiPropertyOptional({ example: 'demo-ndis-care', description: 'Which demo company to enter' })
  companyId?: string;
}

export class SelectCompanyDto {
  @ApiProperty({ example: 'clxyz123' })
  companyId!: string;
}

export class AddEntityDto {
  @ApiProperty({ example: 'Acme Holdings Ltd' })
  name!: string;

  @ApiPropertyOptional({ example: 'Construction' })
  industry?: string;

  @ApiProperty({ example: 'GBP' })
  currency!: string;

  @ApiProperty({ example: 1, description: 'Fiscal year start month (1–12)' })
  fiscalYearStart!: number;

  @ApiProperty({ example: 13 })
  forecastHorizonWeeks!: number;

  @ApiProperty({ example: 0 })
  openingCashBalance!: number;

  @ApiPropertyOptional({ example: 'en' })
  locale?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Switch active workspace to the new entity after creation',
  })
  switchToNew?: boolean;

  @ApiPropertyOptional({ type: [OnboardingBankAccountDto] })
  bankAccounts?: OnboardingBankAccountDto[];
}
