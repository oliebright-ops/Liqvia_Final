import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCashOsLeadDto {
  @ApiProperty({ example: 'Иван Петров' })
  name!: string;

  @ApiPropertyOptional({ example: 'Генеральный директор' })
  role?: string;

  @ApiProperty({ example: 'ООО «Пример»' })
  companyName!: string;

  @ApiProperty({ example: '+7 900 000-00-00' })
  phone!: string;

  @ApiProperty({ example: 'ivan@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Хотим обсудить прогноз ДДС на 13 недель' })
  comment?: string;

  @ApiPropertyOptional({ description: 'Campaign/CTA tag the lead came from', example: 'pilot-programme' })
  source?: string;
}
