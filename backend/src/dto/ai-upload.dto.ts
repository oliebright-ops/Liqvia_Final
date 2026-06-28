import { ApiPropertyOptional } from '@nestjs/swagger';
import { BankSourceFormat } from '@liqvia2/shared';

export class AiNormalizeUploadDto {
  @ApiPropertyOptional({ example: 'auto', enum: ['auto', 'xero', 'onec', 'paycom', 'sap', 'oracle', 'cba', 'amex', 'generic'] })
  sourceHint?: BankSourceFormat;

  @ApiPropertyOptional({ description: 'Raw CSV content from any bank export' })
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
  @ApiPropertyOptional()
  canonicalCsv!: string;

  @ApiPropertyOptional({ example: 'normalized-bank.csv' })
  fileName?: string;

  @ApiPropertyOptional({ example: 'USD' })
  companyCurrency?: string;
}
