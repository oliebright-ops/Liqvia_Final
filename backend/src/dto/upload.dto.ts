import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UPLOAD_TEMPLATE_TYPES, UploadTemplateType } from '@liqvia2/shared';

export class ValidateUploadDto {
  @ApiProperty({ enum: UPLOAD_TEMPLATE_TYPES, example: 'ar_ageing' })
  templateType!: UploadTemplateType;

  @ApiProperty({ description: 'Raw CSV file content', example: 'Customer Name,Invoice Number\nAcme,INV-1' })
  csvContent!: string;

  @ApiPropertyOptional({ example: 'USD' })
  companyCurrency?: string;
}

export class ImportUploadDto {
  @ApiProperty({ enum: UPLOAD_TEMPLATE_TYPES, example: 'bank_balances' })
  templateType!: UploadTemplateType;

  @ApiProperty()
  csvContent!: string;

  @ApiProperty({ example: 'bank-balances.csv' })
  fileName!: string;

  @ApiPropertyOptional({ example: 'demo-consulting' })
  companyId?: string;

  @ApiPropertyOptional({ example: 'USD' })
  companyCurrency?: string;
}

export class ValidateUploadFileDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: Express.Multer.File;

  @ApiProperty({ enum: UPLOAD_TEMPLATE_TYPES })
  templateType!: string;

  @ApiPropertyOptional({ example: 'USD' })
  companyCurrency?: string;
}
