import { Injectable, Logger } from '@nestjs/common';
import {
  AiBankNormalizeResult,
  BankColumnMapping,
  BankSignConvention,
  BankSourceFormat,
  normalizeBankUploadCsv,
  parseCsv,
  spreadsheetToCsvString,
  validateUpload,
} from '@liqvia2/shared';

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

  normalizeFileBuffer(
    buffer: Buffer,
    fileName: string,
    options: {
      sourceHint?: BankSourceFormat;
      defaultBankAccountName?: string;
      defaultAccountMasked?: string;
      companyCurrency?: string;
    },
  ): Promise<AiUploadNormalizeResponse> {
    const csvContent = spreadsheetToCsvString(buffer, fileName);
    return this.normalizeInternal(csvContent, { ...options, fileName });
  }

  private async normalizeInternal(
    csvContent: string,
    options: {
      sourceHint?: BankSourceFormat;
      defaultBankAccountName?: string;
      defaultAccountMasked?: string;
      companyCurrency?: string;
      fileName?: string;
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

    if (apiKey && (result.confidence === 'low' || result.rowCount === 0)) {
      try {
        const ai = await this.inferMappingWithOpenAi(apiKey, csvContent, options);
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

  private async inferMappingWithOpenAi(
    apiKey: string,
    csvContent: string,
    options: { sourceHint?: BankSourceFormat; fileName?: string },
  ): Promise<AiMappingResponse | null> {
    const parsed = parseCsv(csvContent.trim());
    const sampleRows = parsed.rows.slice(0, 8).map((cells) => {
      const row: Record<string, string> = {};
      parsed.headers.forEach((h, i) => {
        row[h] = cells[i] ?? '';
      });
      return row;
    });

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
