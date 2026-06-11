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
}

export class OnboardingTeamMemberDto {
  @ApiProperty({ example: 'Alex Analyst' })
  name!: string;

  @ApiProperty({ example: 'alex@acme.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'MemberPass123!' })
  password?: string;

  @ApiProperty({ enum: ['member', 'viewer', 'admin'], example: 'member' })
  role!: 'member' | 'viewer' | 'admin';
}

export class OnboardingCreateCompanyDto {
  @ApiProperty({ type: OnboardingCompanyDto })
  company!: OnboardingCompanyDto;

  @ApiPropertyOptional({ type: [OnboardingTeamMemberDto] })
  teamMembers?: OnboardingTeamMemberDto[];
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
}
