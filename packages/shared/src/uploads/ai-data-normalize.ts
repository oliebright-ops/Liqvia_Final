import { parseCsv } from '../csv/parse-csv';
import { toIsoWeek } from '../reporting-period';
import type { UploadTemplateType } from './types';
import { UPLOAD_TEMPLATES } from './templates';
import {
  normalizeBankUploadCsv,
  mergeAiBankNormalizeResults,
  type AiBankNormalizeResult,
  type BankColumnMapping,
  type BankSignConvention,
  type BankSourceFormat,
} from './ai-bank-normalize';

export const AI_UPLOAD_TEMPLATE_TYPES = [
  'bank_transactions',
  'ar_ageing',
  'ap_ageing',
  'expense_report',
  'weekly_actuals',
  'bank_balances',
] as const satisfies readonly UploadTemplateType[];

export type AiUploadTemplateType = (typeof AI_UPLOAD_TEMPLATE_TYPES)[number];

export type AiDataNormalizeResult = {
  templateType: UploadTemplateType;
  detectedFormat: string;
  mapping: Record<string, string | undefined>;
  confidence: 'high' | 'medium' | 'low';
  source: 'rules' | 'ai';
  warnings: string[];
  skippedRows: number;
  rowCount: number;
  previewRows: Record<string, unknown>[];
  canonicalCsv: string;
};

type GenericMapping = Record<string, string | undefined>;

type GenericProfile = {
  id: string;
  aliases: Record<string, string[]>;
  scoreHeaders: (normalizedHeaders: string[]) => number;
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\u200b\uFEFF]/g, '')
    .replace(/[_\s./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const exact = normalized.findIndex((h) => h === target);
    if (exact >= 0) return headers[exact];
    const partial = normalized.findIndex((h) => h.includes(target) || target.includes(h));
    if (partial >= 0) return headers[partial];
  }
  return undefined;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildCanonicalCsv(headers: readonly string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header] ?? '')).join(','));
  }
  return lines.join('\n');
}

function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/^\((.*)\)$/, '-$1')
    .replace(/[^0-9.,-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else normalized = cleaned.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    let yyyy = dmy[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function scoreAny(normalizedHeaders: string[], tokens: string[]): number {
  let score = 0;
  for (const token of tokens) {
    const t = normalizeHeader(token);
    if (normalizedHeaders.some((h) => h.includes(t) || t.includes(h))) score += 1;
  }
  return score;
}

const AR_PROFILE: GenericProfile = {
  id: 'ar',
  aliases: {
    'Customer Name': ['customer', 'client', 'debtor', 'account name', 'name'],
    'Invoice Number': ['invoice number', 'invoice no', 'invoice #', 'document number', 'reference'],
    'Invoice Date': ['invoice date', 'issue date', 'document date', 'date'],
    'Due Date': ['due date', 'payment due', 'maturity date'],
    'Outstanding Amount': ['outstanding', 'amount due', 'balance', 'open amount', 'amount'],
    Currency: ['currency', 'curr'],
  },
  scoreHeaders: (headers) =>
    scoreAny(headers, ['customer', 'invoice', 'due date', 'outstanding', 'receivable']),
};

const AP_PROFILE: GenericProfile = {
  id: 'ap',
  aliases: {
    'Supplier Name': ['supplier', 'vendor', 'creditor', 'payee', 'name'],
    'Bill Number': ['bill number', 'invoice number', 'document number', 'reference'],
    'Bill Date': ['bill date', 'invoice date', 'document date', 'date'],
    'Due Date': ['due date', 'payment due'],
    'Outstanding Amount': ['outstanding', 'amount due', 'balance', 'open amount', 'amount'],
    'Supplier Priority': ['priority', 'supplier priority', 'payment priority'],
    Currency: ['currency', 'curr'],
  },
  scoreHeaders: (headers) =>
    scoreAny(headers, ['supplier', 'vendor', 'bill', 'due date', 'payable']),
};

const EXPENSE_PROFILE: GenericProfile = {
  id: 'expense',
  aliases: {
    'Transaction Date': ['transaction date', 'date', 'posting date', 'expense date'],
    Payee: ['payee', 'vendor', 'supplier', 'merchant', 'employee'],
    Description: ['description', 'details', 'memo', 'narrative', 'purpose'],
    Category: ['category', 'type', 'expense type', 'class'],
    Amount: ['amount', 'value', 'expense amount', 'net amount', 'total'],
    Currency: ['currency', 'curr'],
  },
  scoreHeaders: (headers) =>
    scoreAny(headers, ['expense', 'payee', 'vendor', 'amount', 'description']),
};

const WEEKLY_PROFILE: GenericProfile = {
  id: 'weekly',
  aliases: {
    Period: ['period', 'week', 'iso week'],
    Category: ['category', 'type'],
    'Account Code': ['account code', 'account', 'gl code', 'code'],
    'Actual Amount': ['actual amount', 'actual', 'amount', 'value'],
  },
  scoreHeaders: (headers) => scoreAny(headers, ['period', 'category', 'actual']),
};

const BANK_BALANCE_PROFILE: GenericProfile = {
  id: 'bank_balance',
  aliases: {
    'Bank Account Name': ['bank account', 'account name', 'account'],
    'Account Number Masked': ['account number', 'masked account', 'account no'],
    Currency: ['currency'],
    'Balance Date': ['balance date', 'as of date', 'date'],
    'Current Balance': ['current balance', 'balance', 'closing balance', 'amount'],
  },
  scoreHeaders: (headers) => scoreAny(headers, ['bank', 'balance', 'account']),
};

const PROFILES: Partial<Record<UploadTemplateType, GenericProfile>> = {
  ar_ageing: AR_PROFILE,
  ap_ageing: AP_PROFILE,
  expense_report: EXPENSE_PROFILE,
  weekly_actuals: WEEKLY_PROFILE,
  bank_balances: BANK_BALANCE_PROFILE,
};

function mapHeaders(
  templateType: UploadTemplateType,
  headers: string[],
  aiMapping?: GenericMapping,
): GenericMapping {
  const profile = PROFILES[templateType];
  const canonicalHeaders = UPLOAD_TEMPLATES[templateType].headers;
  const mapping: GenericMapping = {};
  for (const canonical of canonicalHeaders) {
    mapping[canonical] = aiMapping?.[canonical] ?? findColumn(headers, profile?.aliases[canonical] ?? [canonical]);
  }
  return mapping;
}

function normalizeCategory(raw: string | undefined): string {
  const value = (raw ?? 'expenses').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (value === 'expense') return 'expenses';
  return value;
}

function normalizePriority(raw: string | undefined): string {
  const value = (raw ?? 'flexible').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return value || 'flexible';
}

function transformGenericRow(
  templateType: UploadTemplateType,
  record: Record<string, string>,
  mapping: GenericMapping,
  defaults: { companyCurrency?: string },
): Record<string, string> | null {
  const canonicalHeaders = UPLOAD_TEMPLATES[templateType].headers;
  const out: Record<string, string> = {};

  switch (templateType) {
    case 'ar_ageing': {
      const invoiceDate = parseDate(record[mapping['Invoice Date'] ?? '']);
      const dueDate = parseDate(record[mapping['Due Date'] ?? '']);
      const amount = parseAmount(record[mapping['Outstanding Amount'] ?? '']);
      if (!invoiceDate || !dueDate || amount === null || amount <= 0) return null;
      out['Customer Name'] = record[mapping['Customer Name'] ?? '']?.trim() || 'Customer';
      out['Invoice Number'] = record[mapping['Invoice Number'] ?? '']?.trim() || `INV-${invoiceDate}`;
      out['Invoice Date'] = invoiceDate;
      out['Due Date'] = dueDate;
      out['Outstanding Amount'] = String(amount);
      out.Currency = (record[mapping.Currency ?? ''] || defaults.companyCurrency || 'USD').toUpperCase();
      break;
    }
    case 'ap_ageing': {
      const billDate = parseDate(record[mapping['Bill Date'] ?? '']);
      const dueDate = parseDate(record[mapping['Due Date'] ?? '']);
      const amount = parseAmount(record[mapping['Outstanding Amount'] ?? '']);
      if (!billDate || !dueDate || amount === null || amount <= 0) return null;
      out['Supplier Name'] = record[mapping['Supplier Name'] ?? '']?.trim() || 'Supplier';
      out['Bill Number'] = record[mapping['Bill Number'] ?? '']?.trim() || `BILL-${billDate}`;
      out['Bill Date'] = billDate;
      out['Due Date'] = dueDate;
      out['Outstanding Amount'] = String(amount);
      out['Supplier Priority'] = normalizePriority(record[mapping['Supplier Priority'] ?? '']);
      out.Currency = (record[mapping.Currency ?? ''] || defaults.companyCurrency || 'USD').toUpperCase();
      break;
    }
    case 'expense_report': {
      const txnDate = parseDate(record[mapping['Transaction Date'] ?? '']);
      const amount = parseAmount(record[mapping.Amount ?? '']);
      if (!txnDate || amount === null || amount <= 0) return null;
      out['Transaction Date'] = txnDate;
      out.Payee = record[mapping.Payee ?? '']?.trim() || 'Vendor';
      out.Description = record[mapping.Description ?? '']?.trim() || out.Payee;
      out.Category = normalizeCategory(record[mapping.Category ?? '']);
      out.Amount = String(amount);
      out.Currency = (record[mapping.Currency ?? ''] || defaults.companyCurrency || 'USD').toUpperCase();
      break;
    }
    case 'weekly_actuals': {
      let period = record[mapping.Period ?? '']?.trim() ?? '';
      const amount = parseAmount(record[mapping['Actual Amount'] ?? '']);
      if (!period) {
        const txnDate = parseDate(record[mapping['Transaction Date'] ?? ''] ?? record[mapping.Period ?? '']);
        if (txnDate) period = toIsoWeek(txnDate);
      }
      if (!/^\d{4}-W\d{2}$/.test(period) || amount === null) return null;
      out.Period = period;
      out.Category = normalizeCategory(record[mapping.Category ?? '']);
      out['Account Code'] = record[mapping['Account Code'] ?? '']?.trim() ?? '';
      out['Actual Amount'] = String(amount);
      break;
    }
    case 'bank_balances': {
      const balanceDate = parseDate(record[mapping['Balance Date'] ?? '']);
      const balance = parseAmount(record[mapping['Current Balance'] ?? '']);
      if (!balanceDate || balance === null) return null;
      out['Bank Account Name'] = record[mapping['Bank Account Name'] ?? '']?.trim() || 'Bank Account';
      out['Account Number Masked'] = record[mapping['Account Number Masked'] ?? '']?.trim() || '****0000';
      out.Currency = (record[mapping.Currency ?? ''] || defaults.companyCurrency || 'USD').toUpperCase();
      out['Balance Date'] = balanceDate;
      out['Current Balance'] = String(balance);
      break;
    }
    default:
      return null;
  }

  for (const header of canonicalHeaders) {
    if (!(header in out)) return null;
  }
  return out;
}

export function normalizeGenericUploadCsv(
  templateType: Exclude<UploadTemplateType, 'bank_transactions'>,
  csvContent: string,
  options?: {
    aiMapping?: GenericMapping;
    companyCurrency?: string;
  },
): AiDataNormalizeResult {
  const parsed = parseCsv(csvContent.trim());
  const profile = PROFILES[templateType];
  const warnings: string[] = [];
  if (parsed.headers.length === 0) {
    return {
      templateType,
      detectedFormat: 'generic',
      mapping: {},
      confidence: 'low',
      source: 'rules',
      warnings: ['Could not parse CSV headers.'],
      skippedRows: 0,
      rowCount: 0,
      previewRows: [],
      canonicalCsv: buildCanonicalCsv(UPLOAD_TEMPLATES[templateType].headers, []),
    };
  }

  const mapping = mapHeaders(templateType, parsed.headers, options?.aiMapping);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  let confidence: AiDataNormalizeResult['confidence'] = 'low';
  if (mappedCount >= UPLOAD_TEMPLATES[templateType].headers.length - 1) confidence = 'high';
  else if (mappedCount >= Math.ceil(UPLOAD_TEMPLATES[templateType].headers.length / 2)) confidence = 'medium';

  const canonicalRows: Record<string, string>[] = [];
  let skippedRows = 0;
  for (const row of parsed.rows) {
    const transformed = transformGenericRow(templateType, row, mapping, {
      companyCurrency: options?.companyCurrency,
    });
    if (!transformed) {
      skippedRows += 1;
      continue;
    }
    canonicalRows.push(transformed);
  }

  if (profile && scoreAny(parsed.headers.map(normalizeHeader), Object.keys(profile.aliases)) >= 3) {
    if (confidence === 'low') confidence = 'medium';
  }

  if (canonicalRows.length === 0) {
    warnings.push('No rows could be mapped — check column headers or try AI-assisted mapping.');
    confidence = 'low';
  }

  const canonicalCsv = buildCanonicalCsv(UPLOAD_TEMPLATES[templateType].headers, canonicalRows);
  return {
    templateType,
    detectedFormat: profile?.id ?? 'generic',
    mapping,
    confidence,
    source: options?.aiMapping ? 'ai' : 'rules',
    warnings,
    skippedRows,
    rowCount: canonicalRows.length,
    previewRows: canonicalRows.slice(0, 50),
    canonicalCsv,
  };
}

export function normalizeAiUploadCsv(
  templateType: UploadTemplateType,
  csvContent: string,
  options?: {
    sourceHint?: BankSourceFormat;
    defaultBankAccountName?: string;
    defaultAccountMasked?: string;
    defaultCurrency?: string;
    aiMapping?: GenericMapping | BankColumnMapping;
    aiSignConvention?: BankSignConvention;
  },
): AiDataNormalizeResult | AiBankNormalizeResult {
  if (templateType === 'bank_transactions') {
    return normalizeBankUploadCsv(csvContent, {
      sourceHint: options?.sourceHint,
      defaultBankAccountName: options?.defaultBankAccountName,
      defaultAccountMasked: options?.defaultAccountMasked,
      defaultCurrency: options?.defaultCurrency,
      aiMapping: options?.aiMapping as BankColumnMapping | undefined,
      aiSignConvention: options?.aiSignConvention,
    });
  }

  return normalizeGenericUploadCsv(templateType, csvContent, {
    aiMapping: options?.aiMapping as GenericMapping | undefined,
    companyCurrency: options?.defaultCurrency,
  });
}

export function mergeAiUploadResults(
  templateType: UploadTemplateType,
  results: Array<AiDataNormalizeResult | AiBankNormalizeResult>,
  fileNames?: string[],
): AiDataNormalizeResult | AiBankNormalizeResult {
  if (templateType === 'bank_transactions') {
    return mergeAiBankNormalizeResults(results as AiBankNormalizeResult[], { fileNames });
  }

  if (results.length === 0) {
    return normalizeGenericUploadCsv(templateType, '');
  }
  if (results.length === 1) {
    return results[0] as AiDataNormalizeResult;
  }

  const generic = results as AiDataNormalizeResult[];
  const headers = UPLOAD_TEMPLATES[templateType].headers;
  const mergedRows = generic.flatMap((result) => {
    const parsed = parseCsv(result.canonicalCsv);
    return parsed.rows;
  });
  const warnings = generic.flatMap((result, index) => {
    const label = fileNames?.[index] ? `[${fileNames[index]}] ` : '';
    return result.warnings.map((warning) => `${label}${warning}`);
  });
  warnings.unshift(`Merged ${generic.length} file(s) into ${mergedRows.length} row(s).`);

  const confidence = generic.reduce<AiDataNormalizeResult['confidence']>(
    (lowest, result) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[result.confidence] < rank[lowest] ? result.confidence : lowest;
    },
    'high',
  );

  return {
    templateType,
    detectedFormat: generic.length > 1 ? 'mixed' : generic[0]!.detectedFormat,
    mapping: generic[0]!.mapping,
    confidence,
    source: generic.some((result) => result.source === 'ai') ? 'ai' : 'rules',
    warnings,
    skippedRows: generic.reduce((total, result) => total + result.skippedRows, 0),
    rowCount: mergedRows.length,
    previewRows: mergedRows.slice(0, 50),
    canonicalCsv: buildCanonicalCsv(headers, mergedRows),
  };
}

export type { GenericMapping as AiColumnMapping };
