import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
