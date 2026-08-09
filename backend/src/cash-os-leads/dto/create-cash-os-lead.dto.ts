import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Evidence of what the user acknowledged, captured alongside the submission itself. */
export class LeadConsentDto {
  @ApiProperty({ example: 'cash-os-lead-form' })
  subjectId!: string;

  @ApiProperty({ description: 'Version of the consent wording that was displayed', example: '2026-08-10.1' })
  version!: string;

  @ApiProperty({ description: 'The exact wording displayed to the user' })
  consentText!: string;

  @ApiPropertyOptional({ example: 'ru' })
  locale?: string;

  @ApiProperty({
    description:
      'Whether the box was actually ticked. Must be exactly `true`: anything else — `false`, or the field omitted — is not an acknowledgement. A required consent without it is rejected; an optional one without it is simply not recorded.',
    example: true,
  })
  accepted!: boolean;

  @ApiPropertyOptional({ description: 'ISO timestamp when the box was ticked', example: '2026-08-10T10:15:00.000Z' })
  acknowledgedAt?: string;
}

export class CreateCashOsLeadDto {
  @ApiProperty({ example: 'Иван Петров' })
  name!: string;

  @ApiPropertyOptional({ example: 'Генеральный директор' })
  role?: string;

  @ApiProperty({ example: 'ООО «Пример»' })
  companyName!: string;

  @ApiPropertyOptional({ example: '+7 900 000-00-00 или @username в Telegram' })
  phone?: string;

  @ApiProperty({ example: 'ivan@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: '20-50' })
  employeeCount?: string;

  @ApiPropertyOptional({ example: 'Строительство' })
  industry?: string;

  @ApiPropertyOptional({ example: 'Хотим обсудить прогноз ДДС на 13 недель' })
  comment?: string;

  @ApiPropertyOptional({ description: 'Campaign/CTA tag the lead came from', example: 'pilot-programme' })
  source?: string;

  @ApiProperty({
    description:
      'Evidence of the required personal-data consent the user ticked. Required — the submission is rejected without it.',
    type: () => LeadConsentDto,
  })
  consent!: LeadConsentDto;

  @ApiPropertyOptional({
    description:
      'Evidence of the separate, optional marketing consent. Present only when that box was ticked; its absence is what records "not given". Never conflated with the required consent above.',
    type: () => LeadConsentDto,
  })
  marketingConsent?: LeadConsentDto;
}
