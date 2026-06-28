import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AI_UPLOAD_TEMPLATE_TYPES, BankSourceFormat, UploadTemplateType } from '@liqvia2/shared';

export class AiNormalizeUploadDto {
  @ApiPropertyOptional({ example: 'bank_transactions', enum: AI_UPLOAD_TEMPLATE_TYPES })
  templateType?: UploadTemplateType;

  @ApiPropertyOptional({ example: 'auto', enum: ['auto', 'xero', 'onec', 'paycom', 'sap', 'oracle', 'cba', 'amex', 'generic'] })
  sourceHint?: BankSourceFormat;

  @ApiPropertyOptional({ description: 'Raw CSV content from any export' })
  csvContent!: string;

  @ApiPropertyOptional({ example: 'Operating Account' })
  defaultBankAccountName?: string;

  @ApiPropertyOptional({ example: '****1234' })
  defaultAccountMasked?: string;

  @ApiPropertyOptional({ example: 'USD' })
  companyCurrency?: string;

  @ApiPropertyOptional({ example: 'xero-export.csv' })
  fileName?: string;
}

export class AiImportNormalizedDto {
  @ApiPropertyOptional({ example: 'bank_transactions', enum: AI_UPLOAD_TEMPLATE_TYPES })
  templateType?: UploadTemplateType;

  @ApiPropertyOptional()
  canonicalCsv!: string;

  @ApiPropertyOptional({ example: 'normalized-upload.csv' })
  fileName?: string;

  @ApiPropertyOptional({ example: 'USD' })
  companyCurrency?: string;
}
