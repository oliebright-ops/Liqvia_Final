import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import {
  getFutureWeekPeriods,
  getPastWeekPeriods,
  spreadsheetToCsvString,
  UPLOAD_TEMPLATES,
  UPLOAD_TEMPLATE_TYPES,
  UploadTemplateType,
} from '@liqvia2/shared';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { ImportUploadDto, ValidateUploadDto } from '../dto/upload.dto';
import { UploadActiveDataService } from './upload-active-data.service';
import { UploadImportService } from './upload-import.service';
import { UploadValidationService } from './upload-validation.service';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadController {
  constructor(
    private readonly validation: UploadValidationService,
    private readonly imports: UploadImportService,
    private readonly activeData: UploadActiveDataService,
  ) {}

  @Get('templates')
  @ApiOperation({ summary: 'List CSV upload templates and required column headers' })
  listTemplates() {
    return UPLOAD_TEMPLATE_TYPES.map((type) => {
      const t = UPLOAD_TEMPLATES[type];
      return {
        type: t.type,
        label: t.label,
        headers: t.headers,
        samplePath: `/api/uploads/templates/${t.type}/sample`,
      };
    });
  }

  @Get('templates/:type/sample')
  @ApiOperation({ summary: 'Download sample CSV for a template type' })
  @ApiParam({ name: 'type', enum: UPLOAD_TEMPLATE_TYPES })
  downloadSample(@Param('type') type: string, @Res() res: Response) {
    const templateType = parseTemplateType(type);
    const template = UPLOAD_TEMPLATES[templateType];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${template.sampleFileName}"`);

    if (
      templateType === 'weekly_actuals' ||
      templateType === 'prior_period_budget' ||
      templateType === 'budget'
    ) {
      const asOfDate = new Date().toISOString().slice(0, 10);
      res.send(buildPastWeekSampleCsv(templateType, getPastWeekPeriods(asOfDate)));
      return;
    }

    if (templateType === 'rolling_budget') {
      const asOfDate = new Date().toISOString().slice(0, 10);
      res.send(buildFutureWeekSampleCsv(getFutureWeekPeriods(asOfDate)));
      return;
    }

    const filePath = join(__dirname, '..', '..', '..', 'samples', template.sampleFileName);

    if (!existsSync(filePath)) {
      throw new BadRequestException(`Sample file not found for ${templateType}`);
    }

    createReadStream(filePath).pipe(res);
  }

  @Post('validate')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Validate CSV or Excel file content (JSON body)' })
  @ApiOkResponse({ description: 'Validation result with errors or parsed row preview' })
  validateBody(@Body() body: ValidateUploadDto) {
    return this.runValidation(body.templateType, body.csvContent, body.companyCurrency);
  }

  @Get('batches')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List recent upload batches for the authenticated company' })
  listBatches(@CurrentUser() user: AuthUser) {
    return this.imports.listBatches(user.companyId!);
  }

  @Get('batches/:id')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Get upload batch detail with stored row snapshot' })
  getBatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imports.getBatch(user.companyId!, id);
  }

  @Get('latest')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Latest completed upload per template type' })
  getLatestByType(@CurrentUser() user: AuthUser) {
    return this.imports.getLatestByType(user.companyId!);
  }

  @Get('active/:type')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Live data currently in use for a template type' })
  @ApiParam({ name: 'type', enum: UPLOAD_TEMPLATE_TYPES })
  getActiveData(@CurrentUser() user: AuthUser, @Param('type') type: string) {
    const templateType = parseTemplateType(type);
    return this.activeData.getActiveData(user.companyId!, templateType);
  }

  @Post('wipe')
  @UseGuards(WorkspaceGuard)
  @Roles(UserRole.admin, UserRole.owner)
  @ApiOperation({
    summary: 'Wipe live financial data; retain upload batch snapshots for reference',
  })
  wipeCompanyData(@CurrentUser() user: AuthUser) {
    return this.imports.wipeCompanyData(user.companyId!);
  }

  @Post('import')
  @UseGuards(WorkspaceGuard)
  @Roles(UserRole.admin, UserRole.owner, UserRole.member)
  @ApiOperation({ summary: 'Validate and import spreadsheet rows into the database' })
  @ApiOkResponse({ description: 'Import batch summary; triggers forecast recalculation' })
  importBody(@CurrentUser() user: AuthUser, @Body() body: ImportUploadDto) {
    return this.imports.importCsv({
      templateType: body.templateType,
      csvContent: body.csvContent,
      fileName: body.fileName,
      companyId: user.companyId!,
      companyCurrency: body.companyCurrency,
    });
  }

  @Post('validate/file')
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
  @UseInterceptors(FileInterceptor('file'))
  validateFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('templateType') templateTypeRaw: string,
    @Body('companyCurrency') companyCurrency?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Spreadsheet file is required (field name: file)');
    }
    const templateType = parseTemplateType(templateTypeRaw);
    let csvContent: string;
    try {
      csvContent = spreadsheetToCsvString(file.buffer, file.originalname);
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
    if (!csvContent?.trim()) {
      throw new BadRequestException('Spreadsheet content is empty');
    }

    const result = this.validation.validate(templateType, csvContent, { companyCurrency });

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

function buildPastWeekSampleCsv(
  templateType: 'weekly_actuals' | 'prior_period_budget' | 'budget',
  periods: string[],
): string {
  const template = UPLOAD_TEMPLATES[templateType];
  const lines = [template.headers.join(',')];
  for (const period of periods) {
    if (templateType === 'weekly_actuals') {
      lines.push(`${period},revenue,,24000`);
      lines.push(`${period},payroll,5000,10800`);
      lines.push(`${period},expenses,,7900`);
    } else if (templateType === 'budget') {
      lines.push(`${period},revenue,4000,25000,operating`);
      lines.push(`${period},payroll,5000,11000,operating`);
      lines.push(`${period},expenses,,8000,operating`);
    } else {
      lines.push(`${period},revenue,4000,25000`);
      lines.push(`${period},payroll,5000,11000`);
      lines.push(`${period},expenses,,8000`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function buildFutureWeekSampleCsv(periods: string[]): string {
  const template = UPLOAD_TEMPLATES.rolling_budget;
  const lines = [template.headers.join(',')];
  for (const period of periods) {
    lines.push(`${period},revenue,4000,26000`);
    lines.push(`${period},payroll,5000,11200`);
    lines.push(`${period},expenses,,8200`);
  }
  return `${lines.join('\n')}\n`;
}

function parseTemplateType(value: string): UploadTemplateType {
  if (UPLOAD_TEMPLATE_TYPES.includes(value as UploadTemplateType)) {
    return value as UploadTemplateType;
  }
  throw new BadRequestException(
    `Invalid templateType. Must be one of: ${UPLOAD_TEMPLATE_TYPES.join(', ')}`,
  );
}
