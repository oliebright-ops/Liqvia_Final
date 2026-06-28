import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AiBankNormalizeResult,
  BankColumnMapping,
  BankSignConvention,
  BankSourceFormat,
  isPdfFileName,
  normalizeBankUploadCsv,
  parseCsv,
  pdfTextToCsv,
  spreadsheetToCsvString,
  validateUpload,
} from '@liqvia2/shared';
import { extractPdfContent } from './pdf-extract';

export type AiUploadNormalizeResponse = Omit<AiBankNormalizeResult, 'canonicalCsv' | 'unifiedRows'> & {
  validation: ReturnType<typeof validateUpload>;
  canonicalCsv: string;
  model?: string;
  source: 'rules' | 'ai';
};

type AiMappingResponse = {
  mapping: BankColumnMapping;
  signConvention: BankSignConvention;
  detectedFormat: BankSourceFormat;
  notes?: string;
};

@Injectable()
export class AiUploadService {
  private readonly logger = new Logger(AiUploadService.name);

  normalizeCsvContent(
    csvContent: string,
    options: {
      sourceHint?: BankSourceFormat;
      defaultBankAccountName?: string;
      defaultAccountMasked?: string;
      companyCurrency?: string;
      fileName?: string;
    },
  ): Promise<AiUploadNormalizeResponse> {
    return this.normalizeInternal(csvContent, options);
  }

  async normalizeFileBuffer(
    buffer: Buffer,
    fileName: string,
    options: {
      sourceHint?: BankSourceFormat;
      defaultBankAccountName?: string;
      defaultAccountMasked?: string;
      companyCurrency?: string;
    },
  ): Promise<AiUploadNormalizeResponse> {
    let csvContent: string;
    let preWarnings: string[] = [];

    if (isPdfFileName(fileName)) {
      const converted = await this.convertPdfBufferToCsv(buffer, fileName);
      csvContent = converted.csv;
      preWarnings = converted.warnings;
    } else {
      try {
        csvContent = spreadsheetToCsvString(buffer, fileName);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Could not read spreadsheet file',
        );
      }
    }

    const response = await this.normalizeInternal(csvContent, { ...options, fileName, fromPdf: isPdfFileName(fileName) });
    if (preWarnings.length > 0) {
      response.warnings = [...preWarnings, ...response.warnings];
    }
    return response;
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
          const aiParsed = pdfTextToCsv(aiCsv);
          if (aiParsed.rowCount > parsed.rowCount) {
            parsed = { ...aiParsed, warnings: ['PDF rows extracted with AI assistance.', ...aiParsed.warnings] };
            warnings.push('PDF table parsed with AI assistance.');
          } else {
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

  private async normalizeInternal(
    csvContent: string,
    options: {
      sourceHint?: BankSourceFormat;
      defaultBankAccountName?: string;
      defaultAccountMasked?: string;
      companyCurrency?: string;
      fileName?: string;
      fromPdf?: boolean;
    },
  ): Promise<AiUploadNormalizeResponse> {
    let result = normalizeBankUploadCsv(csvContent, {
      sourceHint: options.sourceHint,
      defaultBankAccountName: options.defaultBankAccountName,
      defaultAccountMasked: options.defaultAccountMasked,
      defaultCurrency: options.companyCurrency,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    let model: string | undefined;
    const needsAiMapping =
      apiKey &&
      (result.confidence === 'low' || result.rowCount === 0 || (options.fromPdf && result.confidence !== 'high'));

    if (needsAiMapping) {
      try {
        const ai = await this.inferMappingWithOpenAi(apiKey!, csvContent, options);
        if (ai) {
          result = normalizeBankUploadCsv(csvContent, {
            sourceHint: options.sourceHint,
            defaultBankAccountName: options.defaultBankAccountName,
            defaultAccountMasked: options.defaultAccountMasked,
            defaultCurrency: options.companyCurrency,
            aiMapping: ai.mapping,
            aiSignConvention: ai.signConvention,
          });
          result = {
            ...result,
            detectedFormat: ai.detectedFormat,
            source: 'ai',
            warnings: ai.notes ? [ai.notes, ...result.warnings] : result.warnings,
          };
          model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
        }
      } catch (err) {
        this.logger.warn(`AI upload mapping failed, keeping rule-based result: ${String(err)}`);
        result.warnings.push('AI column mapping unavailable — using rule-based detection only.');
      }
    }

    const validation = validateUpload('bank_transactions', result.canonicalCsv, {
      companyCurrency: options.companyCurrency,
    });

    const { unifiedRows: _u, ...rest } = result;
    return {
      ...rest,
      validation,
      canonicalCsv: result.canonicalCsv,
      model,
    };
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

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}`);
    }

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
    options: { sourceHint?: BankSourceFormat; fileName?: string },
  ): Promise<AiMappingResponse | null> {
    const parsed = parseCsv(csvContent.trim());
    const sampleRows = parsed.rows.slice(0, 8);

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
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
            content: `You map heterogeneous bank transaction exports to canonical fields.
Return JSON: { "detectedFormat": "xero|onec|paycom|sap|oracle|cba|amex|generic", "signConvention": "signed_negative_in|signed_positive_in|debit_credit_columns|direction_column|split_in_out_columns", "mapping": { optional header names from the file for: bankAccountName, accountNumberMasked, transactionDate, description, payee, amount, debit, credit, direction, spent, received, currency }, "notes": "short string" }.
Rules: use exact header strings from the sample. Bank convention: minus/credit often means money IN; plus/debit often means money OUT (signed_negative_in). Xero uses spent/received columns (split_in_out_columns). SAP/Oracle often use debit/credit columns.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              sourceHint: options.sourceHint ?? 'auto',
              fileName: options.fileName,
              headers: parsed.headers,
              sampleRows,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}`);
    }

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
