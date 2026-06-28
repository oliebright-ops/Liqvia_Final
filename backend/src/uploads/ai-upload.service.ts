import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AiBankNormalizeResult,
  AiDataNormalizeResult,
  AI_UPLOAD_TEMPLATE_TYPES,
  AiUploadTemplateType,
  BankColumnMapping,
  BankSignConvention,
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

type AiMappingResponse = {
  mapping: Record<string, string | undefined>;
  signConvention?: BankSignConvention;
  detectedFormat?: string;
  notes?: string;
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
  private readonly logger = new Logger(AiUploadService.name);

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
      const converted = await this.convertPdfBufferToCsv(buffer, fileName);
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
    fileName: string,
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && (parsed.confidence === 'low' || parsed.rowCount === 0) && text) {
      try {
        const aiCsv = await this.inferCsvFromPdfTextWithOpenAi(apiKey, text, fileName);
        if (aiCsv) {
          const direct = parseCsv(aiCsv.trim());
          if (direct.rows.length > parsed.rowCount) {
            parsed = {
              csv: aiCsv.trim(),
              confidence: direct.rows.length >= 3 ? 'medium' : 'low',
              warnings: ['PDF rows extracted with AI assistance.'],
              rowCount: direct.rows.length,
            };
            warnings.push('PDF table parsed with AI assistance.');
          }
        }
      } catch (err) {
        this.logger.warn(`AI PDF table extraction failed: ${String(err)}`);
        warnings.push('AI PDF parsing unavailable — using rule-based extraction only.');
      }
    }

    if (!parsed.csv.trim() || parsed.rowCount === 0) {
      throw new BadRequestException(
        'Could not extract transaction rows from this PDF. Try exporting CSV/Excel from your bank, or ensure the PDF is a text-based statement.',
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
    let result = normalizeAiUploadCsv(options.templateType, csvContent, {
      sourceHint: options.sourceHint,
      defaultBankAccountName: options.defaultBankAccountName,
      defaultAccountMasked: options.defaultAccountMasked,
      defaultCurrency: options.companyCurrency,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    let model: string | undefined;
    const needsAiMapping =
      apiKey &&
      (result.confidence === 'low' ||
        result.rowCount === 0 ||
        ((options.fromPdf || options.templateType !== 'bank_transactions') &&
          result.confidence !== 'high'));

    if (needsAiMapping) {
      try {
        const ai = await this.inferMappingWithOpenAi(apiKey!, csvContent, options);
        if (ai) {
          result = normalizeAiUploadCsv(options.templateType, csvContent, {
            sourceHint: options.sourceHint,
            defaultBankAccountName: options.defaultBankAccountName,
            defaultAccountMasked: options.defaultAccountMasked,
            defaultCurrency: options.companyCurrency,
            aiMapping: ai.mapping as BankColumnMapping,
            aiSignConvention: ai.signConvention,
          });
          result = {
            ...result,
            detectedFormat: ai.detectedFormat ?? ('detectedFormat' in result ? result.detectedFormat : options.templateType),
            source: 'ai',
            warnings: ai.notes ? [ai.notes, ...result.warnings] : result.warnings,
          } as AiBankNormalizeResult | AiDataNormalizeResult;
          model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
        }
      } catch (err) {
        this.logger.warn(`AI upload mapping failed, keeping rule-based result: ${String(err)}`);
        result.warnings.push('AI column mapping unavailable — using rule-based detection only.');
      }
    }

    return { result, model };
  }

  private async inferCsvFromPdfTextWithOpenAi(
    apiKey: string,
    pdfText: string,
    fileName?: string,
  ): Promise<string | null> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const trimmed = pdfText.length > 12000 ? `${pdfText.slice(0, 12000)}\n...[truncated]` : pdfText;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You extract bank transaction rows from PDF statement text into CSV.
Return JSON: { "csv": "header1,header2\\nvalue1,value2\\n..." }.
Use a header row with clear column names (Date, Description, Amount and/or Debit/Credit, etc.).
Include every transaction row; omit statement headers, footers, totals, and legal text.
Preserve amounts and signs exactly as shown in the PDF.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ fileName, pdfText: trimmed }),
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsedJson = JSON.parse(content) as { csv?: string };
    if (!parsedJson.csv || typeof parsedJson.csv !== 'string') return null;
    return parsedJson.csv.trim();
  }

  private async inferMappingWithOpenAi(
    apiKey: string,
    csvContent: string,
    options: NormalizeOptions,
  ): Promise<AiMappingResponse | null> {
    const parsed = parseCsv(csvContent.trim());
    const sampleRows = parsed.rows.slice(0, 8);
    const canonicalHeaders = UPLOAD_TEMPLATES[options.templateType].headers;

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const systemPrompt =
      options.templateType === 'bank_transactions'
        ? `You map heterogeneous bank transaction exports to canonical fields.
Return JSON: { "detectedFormat": "xero|onec|paycom|sap|oracle|cba|amex|generic", "signConvention": "signed_negative_in|signed_positive_in|debit_credit_columns|direction_column|split_in_out_columns", "mapping": { optional source header names for canonical fields }, "notes": "short string" }.
Canonical fields: bankAccountName, accountNumberMasked, transactionDate, description, payee, amount, debit, credit, direction, spent, received, currency.
Rules: use exact header strings from the sample.`
        : `You map heterogeneous finance exports to canonical Liqvia upload columns.
Return JSON: { "detectedFormat": "generic|xero|quickbooks|myob|sap|oracle", "mapping": { "Canonical Header": "Exact Source Header" }, "notes": "short string" }.
Target template: ${options.templateType}
Required canonical headers: ${canonicalHeaders.join(', ')}
Use exact source header strings from the sample.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              templateType: options.templateType,
              sourceHint: options.sourceHint ?? 'auto',
              fileName: options.fileName,
              headers: parsed.headers,
              sampleRows,
            }),
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsedJson = JSON.parse(content) as AiMappingResponse;
    if (!parsedJson.mapping || typeof parsedJson.mapping !== 'object') return null;
    return parsedJson;
  }
}
