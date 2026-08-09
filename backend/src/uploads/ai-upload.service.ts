import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AiBankNormalizeResult,
  AiDataNormalizeResult,
  AI_UPLOAD_TEMPLATE_TYPES,
  AiUploadTemplateType,
  BankSourceFormat,
  isAiUploadFileName,
  isPdfFileName,
  mergeAiUploadResults,
  normalizeAiUploadCsv,
  parseCsv,
  pdfTextToCsv,
  spreadsheetToCsvString,
  UploadTemplateType,
  UPLOAD_TEMPLATES,
  validateUpload,
} from '@liqvia2/shared';
import { extractPdfContent } from './pdf-extract';

export type AiUploadFileResult = {
  fileName: string;
  rowCount: number;
  detectedFormat: string;
  confidence: AiDataNormalizeResult['confidence'];
};

export type AiUploadNormalizeResponse = {
  templateType: UploadTemplateType;
  detectedFormat: string;
  signConvention?: string;
  mapping: Record<string, string | undefined>;
  confidence: 'high' | 'medium' | 'low';
  source: 'rules' | 'ai';
  warnings: string[];
  skippedRows: number;
  rowCount: number;
  previewRows: Record<string, unknown>[];
  validation: ReturnType<typeof validateUpload>;
  canonicalCsv: string;
  model?: string;
  filesProcessed?: number;
  fileResults?: AiUploadFileResult[];
};

type NormalizeOptions = {
  templateType: AiUploadTemplateType;
  sourceHint?: BankSourceFormat;
  defaultBankAccountName?: string;
  defaultAccountMasked?: string;
  companyCurrency?: string;
  fileName?: string;
  fromPdf?: boolean;
};

@Injectable()
export class AiUploadService {
  normalizeCsvContent(
    csvContent: string,
    options: Omit<NormalizeOptions, 'fileName' | 'fromPdf'> & { fileName?: string },
  ): Promise<AiUploadNormalizeResponse> {
    return this.normalizeContent(csvContent, { ...options, fileName: options.fileName });
  }

  async normalizeFileBuffer(
    buffer: Buffer,
    fileName: string,
    options: Omit<NormalizeOptions, 'fileName' | 'fromPdf'>,
  ): Promise<AiUploadNormalizeResponse> {
    this.assertTemplateSupported(options.templateType);
    const { csvContent, preWarnings } = await this.fileBufferToCsv(buffer, fileName);
    const response = await this.normalizeContent(csvContent, {
      ...options,
      fileName,
      fromPdf: isPdfFileName(fileName),
    });
    if (preWarnings.length > 0) {
      response.warnings = [...preWarnings, ...response.warnings];
    }
    return response;
  }

  async normalizeMultipleFileBuffers(
    files: Array<{ buffer: Buffer; fileName: string }>,
    options: Omit<NormalizeOptions, 'fileName' | 'fromPdf'>,
  ): Promise<AiUploadNormalizeResponse> {
    this.assertTemplateSupported(options.templateType);

    if (files.length === 0) {
      throw new BadRequestException('At least one file is required (field name: files)');
    }

    for (const file of files) {
      if (!isAiUploadFileName(file.fileName)) {
        throw new BadRequestException(
          `Unsupported file type: ${file.fileName}. Use CSV, Excel (.xlsx, .xls), or PDF.`,
        );
      }
    }

    if (files.length === 1) {
      const single = await this.normalizeFileBuffer(files[0]!.buffer, files[0]!.fileName, options);
      return {
        ...single,
        filesProcessed: 1,
        fileResults: [
          {
            fileName: files[0]!.fileName,
            rowCount: single.rowCount,
            detectedFormat: single.detectedFormat,
            confidence: single.confidence,
          },
        ],
      };
    }

    const normalized: Array<AiBankNormalizeResult | AiDataNormalizeResult> = [];
    const fileResults: AiUploadFileResult[] = [];
    const failures: string[] = [];
    let model: string | undefined;

    for (const file of files) {
      try {
        const { csvContent, preWarnings } = await this.fileBufferToCsv(file.buffer, file.fileName);
        const { result, model: fileModel } = await this.normalizeContentToResult(csvContent, {
          ...options,
          fileName: file.fileName,
          fromPdf: isPdfFileName(file.fileName),
        });
        if (preWarnings.length > 0) {
          result.warnings = [...preWarnings, ...result.warnings];
        }
        if (fileModel) model = fileModel;
        normalized.push(result);
        fileResults.push({
          fileName: file.fileName,
          rowCount: 'rowCount' in result ? result.rowCount : 0,
          detectedFormat:
            'detectedFormat' in result ? String(result.detectedFormat) : options.templateType,
          confidence: result.confidence,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not normalize file';
        failures.push(`${file.fileName}: ${message}`);
      }
    }

    if (normalized.length === 0) {
      throw new BadRequestException(
        failures.length > 0 ? failures.join('; ') : 'No files could be normalized',
      );
    }

    const merged = mergeAiUploadResults(options.templateType, normalized, fileResults.map((f) => f.fileName));
    if (failures.length > 0) {
      merged.warnings.push(`Skipped ${failures.length} file(s): ${failures.join('; ')}`);
    }

    return this.finalizeResponse(options.templateType, merged, options.companyCurrency, model, {
      filesProcessed: fileResults.length,
      fileResults,
    });
  }

  private assertTemplateSupported(templateType: UploadTemplateType) {
    if (!AI_UPLOAD_TEMPLATE_TYPES.includes(templateType as AiUploadTemplateType)) {
      throw new BadRequestException(
        `AI Upload Centre does not support template type "${templateType}". Supported: ${AI_UPLOAD_TEMPLATE_TYPES.join(', ')}`,
      );
    }
  }

  private async fileBufferToCsv(
    buffer: Buffer,
    fileName: string,
  ): Promise<{ csvContent: string; preWarnings: string[] }> {
    if (isPdfFileName(fileName)) {
      const converted = await this.convertPdfBufferToCsv(buffer);
      return { csvContent: converted.csv, preWarnings: converted.warnings };
    }

    try {
      return { csvContent: spreadsheetToCsvString(buffer, fileName), preWarnings: [] };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Could not read spreadsheet file',
      );
    }
  }

  private async convertPdfBufferToCsv(
    buffer: Buffer,
  ): Promise<{ csv: string; warnings: string[] }> {
    let text: string;
    let pageCount = 0;
    let tableCsv: string | null = null;
    try {
      const extracted = await extractPdfContent(buffer);
      text = extracted.text;
      pageCount = extracted.pageCount;
      tableCsv = extracted.tableCsv;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Could not read PDF file',
      );
    }

    if (!text && !tableCsv) {
      throw new BadRequestException(
        pageCount > 0
          ? 'This PDF appears to be scanned or image-only. Export CSV/Excel from your bank, or upload a text-based PDF statement.'
          : 'PDF file is empty or could not be read.',
      );
    }

    let parsed: ReturnType<typeof pdfTextToCsv>;
    if (tableCsv?.trim()) {
      const direct = parseCsv(tableCsv.trim());
      if (direct.rows.length > 0) {
        parsed = {
          csv: tableCsv.trim(),
          confidence: direct.rows.length >= 3 ? 'high' : 'medium',
          warnings: [],
          rowCount: direct.rows.length,
        };
      } else {
        parsed = pdfTextToCsv(text || tableCsv);
      }
    } else {
      parsed = pdfTextToCsv(text);
    }
    const warnings = [...parsed.warnings];

    // A low-confidence PDF used to be forwarded to OpenAI as up to 12,000 characters
    // of raw bank-statement text. That path is removed: raw statement content must
    // never leave Liqvia. When deterministic extraction cannot read the file we say
    // so and offer a route the customer controls, rather than guessing via an
    // external model.
    if (!parsed.csv.trim() || parsed.rowCount === 0 || parsed.confidence === 'low') {
      throw new BadRequestException(
        'Could not confidently read transaction rows from this PDF. ' +
          'Export CSV or Excel from your bank and upload that instead, or use the Liqvia bank-transactions template. ' +
          'PDF statement text is never sent to an external service.',
      );
    }

    return { csv: parsed.csv, warnings };
  }

  private async normalizeContent(
    csvContent: string,
    options: NormalizeOptions,
  ): Promise<AiUploadNormalizeResponse> {
    const { result, model } = await this.normalizeContentToResult(csvContent, options);
    return this.finalizeResponse(options.templateType, result, options.companyCurrency, model);
  }

  private finalizeResponse(
    templateType: UploadTemplateType,
    result: AiBankNormalizeResult | AiDataNormalizeResult,
    companyCurrency?: string,
    model?: string,
    extras?: Pick<AiUploadNormalizeResponse, 'filesProcessed' | 'fileResults'>,
  ): AiUploadNormalizeResponse {
    const validation = validateUpload(templateType, result.canonicalCsv, {
      companyCurrency,
    });

    const signConvention =
      'signConvention' in result ? result.signConvention : undefined;
    const detectedFormat =
      'detectedFormat' in result ? String(result.detectedFormat) : templateType;

    return {
      templateType,
      detectedFormat,
      signConvention,
      mapping: result.mapping,
      confidence: result.confidence,
      source: result.source,
      warnings: result.warnings,
      skippedRows: result.skippedRows,
      rowCount: result.rowCount,
      previewRows: result.previewRows,
      validation,
      canonicalCsv: result.canonicalCsv,
      model,
      ...extras,
    };
  }

  private async normalizeContentToResult(
    csvContent: string,
    options: NormalizeOptions,
  ): Promise<{ result: AiBankNormalizeResult | AiDataNormalizeResult; model?: string }> {
    const result = normalizeAiUploadCsv(options.templateType, csvContent, {
      sourceHint: options.sourceHint,
      defaultBankAccountName: options.defaultBankAccountName,
      defaultAccountMasked: options.defaultAccountMasked,
      defaultCurrency: options.companyCurrency,
    });

    // The low-confidence fallback used to post eight complete raw data rows — every
    // value, not just headers — to OpenAI to guess a column mapping. That path is
    // removed. Uploaded rows are the customer's raw records and must never be sent
    // to an external model to solve a parsing problem.
    //
    // When deterministic detection cannot map the file, the response carries
    // `needsManualMapping` and the detected headers so the UI can ask the user to
    // map the columns themselves. See `resolveLowConfidence`.
    return { result: this.resolveLowConfidence(result, options), model: undefined };
  }

  /**
   * Decides what happens when rule-based detection is not confident.
   *
   * Three outcomes, in order of preference:
   *  1. Ask the user to map the columns (headers are known, rows are not).
   *  2. Point them at a supported template.
   *  3. Return a safe parsing error.
   *
   * Never: send the data to a model and hope.
   */
  private resolveLowConfidence(
    result: AiBankNormalizeResult | AiDataNormalizeResult,
    options: NormalizeOptions,
  ): AiBankNormalizeResult | AiDataNormalizeResult {
    const isConfident = result.confidence === 'high' || (result.confidence === 'medium' && result.rowCount > 0);
    if (isConfident) return result;

    if (result.rowCount === 0) {
      throw new BadRequestException(
        `Could not read any rows from this file for the "${options.templateType}" template. ` +
          `Expected columns: ${UPLOAD_TEMPLATES[options.templateType].headers.join(', ')}. ` +
          'Download the Liqvia template and re-upload, or map the columns manually.',
      );
    }

    return {
      ...result,
      warnings: [
        'Some columns could not be matched automatically. Review the mapping before importing.',
        ...result.warnings,
      ],
    } as AiBankNormalizeResult | AiDataNormalizeResult;
  }

}
