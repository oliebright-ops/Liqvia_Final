import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  buildTemplateSampleCsv,
  buildTemplateSampleXlsx,
  getTemplateSampleFileName,
  MAX_UPLOAD_FILE_BYTES,
  MAX_AI_UPLOAD_FILES,
  spreadsheetToCsvString,
  UPLOAD_TEMPLATES,
  UPLOAD_TEMPLATE_TYPES,
  UploadTemplateType,
} from '@liqvia2/shared';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { ImportUploadDto, ValidateUploadDto } from '../dto/upload.dto';
import { AiImportNormalizedDto, AiNormalizeUploadDto } from '../dto/ai-upload.dto';
import { AiUploadService } from './ai-upload.service';
import { UploadActiveDataService } from './upload-active-data.service';
import { UploadImportService } from './upload-import.service';
import {
  assertUploadCsvContent,
  assertUploadFileSize,
  sanitizeUploadFileName,
} from './upload-content.util';
import { UploadValidationService } from './upload-validation.service';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadController {
  constructor(
    private readonly validation: UploadValidationService,
    private readonly imports: UploadImportService,
    private readonly activeData: UploadActiveDataService,
    private readonly aiUpload: AiUploadService,
  ) {}

  @Get('templates')
  @Permissions('uploads:read')
  @ApiOperation({ summary: 'List upload templates and required column headers' })
  listTemplates() {
    return UPLOAD_TEMPLATE_TYPES.map((type) => {
      const t = UPLOAD_TEMPLATES[type];
      return {
        type: t.type,
        label: t.label,
        headers: t.headers,
        samplePath: `/api/uploads/templates/${t.type}/sample`,
        sampleXlsxPath: `/api/uploads/templates/${t.type}/sample?format=xlsx`,
      };
    });
  }

  @Get('templates/:type/sample')
  @Permissions('uploads:read')
  @ApiOperation({ summary: 'Download sample CSV or Excel template for a data type' })
  @ApiParam({ name: 'type', enum: UPLOAD_TEMPLATE_TYPES })
  downloadSample(
    @Param('type') type: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const templateType = parseTemplateType(type);
    const asOfDate = new Date().toISOString().slice(0, 10);
    const wantsXlsx = format?.toLowerCase() === 'xlsx';

    if (wantsXlsx) {
      const buffer = buildTemplateSampleXlsx(templateType, asOfDate);
      const fileName = getTemplateSampleFileName(templateType, 'xlsx');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
      return;
    }

    const csv = buildTemplateSampleCsv(templateType, asOfDate);
    const fileName = getTemplateSampleFileName(templateType, 'csv');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  }

  @Post('ai/normalize')
  @SkipThrottle()
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiOperation({
    summary: 'AI Upload Centre — normalize heterogeneous bank exports to canonical bank_transactions CSV',
  })
  normalizeAi(@CurrentUser() user: AuthUser, @Body() body: AiNormalizeUploadDto) {
    const csvContent = assertUploadCsvContent(body.csvContent);
    return this.aiUpload.normalizeCsvContent(csvContent, {
      sourceHint: body.sourceHint,
      defaultBankAccountName: body.defaultBankAccountName,
      defaultAccountMasked: body.defaultAccountMasked,
      companyCurrency: body.companyCurrency,
      fileName: body.fileName,
    });
  }

  @Post('ai/normalize/file')
  @SkipThrottle()
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'AI Upload Centre — normalize uploaded CSV, Excel, or PDF bank export file' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
    }),
  )
  normalizeAiFile(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('sourceHint') sourceHintRaw?: string,
    @Body('defaultBankAccountName') defaultBankAccountName?: string,
    @Body('defaultAccountMasked') defaultAccountMasked?: string,
    @Body('companyCurrency') companyCurrency?: string,
  ) {
    assertUploadFileSize(file?.buffer?.byteLength ?? file?.size);
    const sourceHint = parseSourceHint(sourceHintRaw);
    return this.aiUpload.normalizeFileBuffer(file!.buffer, sanitizeUploadFileName(file!.originalname, 'upload.csv'), {
      sourceHint,
      defaultBankAccountName,
      defaultAccountMasked,
      companyCurrency,
    });
  }

  @Post('ai/normalize/files')
  @SkipThrottle()
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'AI Upload Centre — normalize multiple CSV, Excel, or PDF bank export files',
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_AI_UPLOAD_FILES, {
      limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
    }),
  )
  normalizeAiFiles(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body('sourceHint') sourceHintRaw?: string,
    @Body('defaultBankAccountName') defaultBankAccountName?: string,
    @Body('defaultAccountMasked') defaultAccountMasked?: string,
    @Body('companyCurrency') companyCurrency?: string,
  ) {
    const batch = files ?? [];
    if (batch.length === 0) {
      throw new BadRequestException('At least one file is required (field name: files)');
    }
    for (const file of batch) {
      assertUploadFileSize(file.buffer?.byteLength ?? file.size);
    }
    const sourceHint = parseSourceHint(sourceHintRaw);
    return this.aiUpload.normalizeMultipleFileBuffers(
      batch.map((file) => ({
        buffer: file.buffer,
        fileName: sanitizeUploadFileName(file.originalname, 'upload.csv'),
      })),
      {
        sourceHint,
        defaultBankAccountName,
        defaultAccountMasked,
        companyCurrency,
      },
    );
  }

  @Post('ai/import')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiOperation({ summary: 'Import AI-normalized canonical bank_transactions CSV' })
  importNormalized(@CurrentUser() user: AuthUser, @Body() body: AiImportNormalizedDto) {
    const csvContent = assertUploadCsvContent(body.canonicalCsv);
    return this.imports.importCsv({
      templateType: 'bank_transactions',
      csvContent,
      fileName: sanitizeUploadFileName(body.fileName, 'ai-bank-transactions.csv'),
      companyId: user.companyId!,
      companyCurrency: body.companyCurrency,
    });
  }

  @Post('validate')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiOperation({ summary: 'Validate CSV or Excel file content (JSON body)' })
  @ApiOkResponse({ description: 'Validation result with errors or parsed row preview' })
  validateBody(@Body() body: ValidateUploadDto) {
    return this.runValidation(body.templateType, body.csvContent, body.companyCurrency);
  }

  @Get('batches')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:read')
  @ApiOperation({ summary: 'List recent upload batches for the authenticated company' })
  listBatches(@CurrentUser() user: AuthUser) {
    return this.imports.listBatches(user.companyId!);
  }

  @Get('batches/:id')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:read')
  @ApiOperation({ summary: 'Get upload batch detail with stored row snapshot' })
  getBatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imports.getBatch(user.companyId!, id);
  }

  @Get('latest')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:read')
  @ApiOperation({ summary: 'Latest completed upload per template type' })
  getLatestByType(@CurrentUser() user: AuthUser) {
    return this.imports.getLatestByType(user.companyId!);
  }

  @Get('active/:type')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:read')
  @ApiOperation({ summary: 'Live data currently in use for a template type' })
  @ApiParam({ name: 'type', enum: UPLOAD_TEMPLATE_TYPES })
  getActiveData(@CurrentUser() user: AuthUser, @Param('type') type: string) {
    const templateType = parseTemplateType(type);
    return this.activeData.getActiveData(user.companyId!, templateType);
  }

  @Post('wipe')
  @UseGuards(WorkspaceGuard)
  @Permissions('settings:admin')
  @ApiOperation({
    summary: 'Wipe live financial data; retain upload batch snapshots for reference',
  })
  wipeCompanyData(@CurrentUser() user: AuthUser) {
    return this.imports.wipeCompanyData(user.companyId!);
  }

  @Post('import')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiOperation({ summary: 'Validate and import spreadsheet rows into the database' })
  @ApiOkResponse({ description: 'Import batch summary; triggers forecast recalculation' })
  importBody(@CurrentUser() user: AuthUser, @Body() body: ImportUploadDto) {
    const csvContent = assertUploadCsvContent(body.csvContent);
    return this.imports.importCsv({
      templateType: body.templateType,
      csvContent,
      fileName: sanitizeUploadFileName(body.fileName, 'upload.csv'),
      companyId: user.companyId!,
      companyCurrency: body.companyCurrency,
    });
  }

  @Post('validate/file')
  @UseGuards(WorkspaceGuard)
  @Permissions('uploads:write')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'templateType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        templateType: { type: 'string', enum: UPLOAD_TEMPLATE_TYPES },
        companyCurrency: { type: 'string', example: 'USD' },
      },
    },
  })
  @ApiOperation({ summary: 'Validate an uploaded CSV or Excel file (multipart)' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
    }),
  )
  validateFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('templateType') templateTypeRaw: string,
    @Body('companyCurrency') companyCurrency?: string,
  ) {
    assertUploadFileSize(file?.buffer?.byteLength ?? file?.size);
    const templateType = parseTemplateType(templateTypeRaw);
    let csvContent: string;
    try {
      csvContent = spreadsheetToCsvString(file!.buffer, file!.originalname);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Could not read spreadsheet file',
      );
    }
    return this.runValidation(templateType, csvContent, companyCurrency);
  }

  private runValidation(
    templateType: UploadTemplateType,
    csvContent: string,
    companyCurrency?: string,
  ) {
    const content = assertUploadCsvContent(csvContent);

    const result = this.validation.validate(templateType, content, { companyCurrency });

    if (!result.valid) {
      return {
        ...result,
        summary: `${result.errors.length} validation error(s) found. Please fix and re-upload.`,
      };
    }

    return {
      ...result,
      summary: `${result.rowCount} row(s) validated successfully.`,
    };
  }
}

function parseSourceHint(value: string | undefined) {
  const hints = ['auto', 'xero', 'onec', 'paycom', 'sap', 'oracle', 'cba', 'amex', 'generic'] as const;
  if (value && hints.includes(value as (typeof hints)[number])) {
    return value as (typeof hints)[number];
  }
  return 'auto' as const;
}

function parseTemplateType(value: string): UploadTemplateType {
  if (UPLOAD_TEMPLATE_TYPES.includes(value as UploadTemplateType)) {
    return value as UploadTemplateType;
  }
  throw new BadRequestException(
    `Invalid templateType. Must be one of: ${UPLOAD_TEMPLATE_TYPES.join(', ')}`,
  );
}
