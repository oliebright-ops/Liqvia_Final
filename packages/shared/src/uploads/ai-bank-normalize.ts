import { parseCsv } from '../csv/parse-csv';
import type { BankTransactionsRow } from './schemas';
import { UPLOAD_TEMPLATES } from './templates';

/** Supported export hints — auto-detected when omitted. */
export type BankSourceFormat =
  | 'auto'
  | 'xero'
  | 'onec'
  | 'paycom'
  | 'sap'
  | 'oracle'
  | 'cba'
  | 'amex'
  | 'generic';

export type BankSignConvention =
  | 'signed_negative_in'
  | 'signed_positive_in'
  | 'debit_credit_columns'
  | 'direction_column'
  | 'split_in_out_columns';

export type UnifiedBankTransactionRow = {
  bankAccountName: string;
  accountNumberMasked: string;
  transactionDate: string;
  description: string;
  payee?: string;
  amount: number;
  direction: 'IN' | 'OUT';
  currency?: string;
};

export type BankColumnMapping = {
  bankAccountName?: string;
  accountNumberMasked?: string;
  transactionDate?: string;
  description?: string;
  payee?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  direction?: string;
  spent?: string;
  received?: string;
  currency?: string;
};

export type AiBankNormalizeResult = {
  detectedFormat: BankSourceFormat;
  signConvention: BankSignConvention;
  mapping: BankColumnMapping;
  confidence: 'high' | 'medium' | 'low';
  source: 'rules' | 'ai';
  warnings: string[];
  skippedRows: number;
  rowCount: number;
  previewRows: BankTransactionsRow[];
  canonicalCsv: string;
  unifiedRows: UnifiedBankTransactionRow[];
};

type RawTable = { headers: string[]; rows: string[][] };

type ColumnAliasLists = Partial<Record<keyof BankColumnMapping, string[]>>;

type FormatProfile = {
  id: Exclude<BankSourceFormat, 'auto'>;
  signConvention: BankSignConvention;
  scoreHeaders: (normalized: string[]) => number;
  aliases: ColumnAliasLists;
  defaults?: Partial<Pick<UnifiedBankTransactionRow, 'bankAccountName' | 'accountNumberMasked' | 'currency'>>;
};

const CANONICAL_HEADERS = UPLOAD_TEMPLATES.bank_transactions.headers;

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
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
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

function maskAccount(raw: string | undefined, fallback = '****0000'): string {
  if (!raw?.trim()) return fallback;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) return `****${digits.slice(-4)}`;
  const trimmed = raw.trim();
  return trimmed.length >= 4 ? trimmed : fallback;
}

function inferDirectionFromSigned(
  amount: number,
  convention: BankSignConvention,
): 'IN' | 'OUT' | null {
  if (amount === 0) return null;
  switch (convention) {
    case 'signed_negative_in':
      return amount < 0 ? 'IN' : 'OUT';
    case 'signed_positive_in':
      return amount > 0 ? 'IN' : 'OUT';
    default:
      return null;
  }
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildBankTransactionsCsv(rows: BankTransactionsRow[]): string {
  const lines = [CANONICAL_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row['Bank Account Name'],
        row['Account Number Masked'],
        row['Transaction Date'],
        row.Description,
        String(row.Amount),
        row.Direction,
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(','),
    );
  }
  return lines.join('\n');
}

function rowToRecord(headers: string[], cells: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((h, i) => {
    record[h] = cells[i] ?? '';
  });
  return record;
}

function buildDescription(payee?: string, description?: string): string {
  const p = payee?.trim();
  const d = description?.trim();
  if (p && d && p !== d) return `${p} — ${d}`;
  return p || d || 'Bank transaction';
}

function scoreAny(normalizedHeaders: string[], tokens: string[]): number {
  let score = 0;
  for (const token of tokens) {
    const t = normalizeHeader(token);
    if (normalizedHeaders.some((h) => h.includes(t) || t.includes(h))) score += 10;
  }
  return score;
}

const FORMAT_PROFILES: FormatProfile[] = [
  {
    id: 'xero',
    signConvention: 'split_in_out_columns',
    scoreHeaders: (h) => scoreAny(h, ['spent', 'received', 'payee', 'particulars', 'reference']),
    aliases: {
      transactionDate: ['date', 'transaction date', 'posted date'],
      payee: ['payee', 'contact', 'name'],
      description: ['description', 'particulars', 'reference', 'details'],
      spent: ['spent', 'debit', 'payment'],
      received: ['received', 'credit', 'deposit'],
      bankAccountName: ['bank account', 'account name', 'account'],
      accountNumberMasked: ['account number', 'account code', 'masked account'],
      currency: ['currency'],
    },
  },
  {
    id: 'cba',
    signConvention: 'signed_negative_in',
    scoreHeaders: (h) => scoreAny(h, ['commbank', 'cba', 'netbank', 'debit', 'credit', 'amount']),
    aliases: {
      transactionDate: ['date', 'transaction date', 'posting date'],
      description: ['description', 'narrative', 'details', 'transaction details'],
      payee: ['payee', 'merchant', 'counterparty'],
      amount: ['amount', 'transaction amount', 'value'],
      bankAccountName: ['account name', 'bank account', 'account'],
      accountNumberMasked: ['account number', 'bsb account', 'account'],
      currency: ['currency'],
    },
  },
  {
    id: 'amex',
    signConvention: 'signed_positive_in',
    scoreHeaders: (h) => scoreAny(h, ['amex', 'american express', 'card member']),
    aliases: {
      transactionDate: ['date', 'transaction date', 'charge date'],
      description: ['description', 'merchant', 'payee', 'transaction description'],
      payee: ['payee', 'merchant', 'vendor'],
      amount: ['amount', 'charge amount', 'transaction amount'],
      bankAccountName: ['account name', 'card account'],
      accountNumberMasked: ['account number', 'card number', 'masked'],
      currency: ['currency'],
    },
  },
  {
    id: 'sap',
    signConvention: 'debit_credit_columns',
    scoreHeaders: (h) => scoreAny(h, ['sap', 'document number', 'posting key', 'gl account']),
    aliases: {
      transactionDate: ['posting date', 'document date', 'value date', 'transaction date'],
      description: ['text', 'document header text', 'item text', 'description'],
      payee: ['vendor', 'customer', 'business partner', 'payee'],
      debit: ['debit', 'debit amount', 'amount in debit'],
      credit: ['credit', 'credit amount', 'amount in credit'],
      bankAccountName: ['house bank', 'bank account', 'account name'],
      accountNumberMasked: ['bank account number', 'account number', 'iban'],
      currency: ['currency', 'document currency'],
    },
  },
  {
    id: 'oracle',
    signConvention: 'debit_credit_columns',
    scoreHeaders: (h) => scoreAny(h, ['oracle', 'cashflow', 'receipt number', 'payment method']),
    aliases: {
      transactionDate: ['transaction date', 'value date', 'accounting date', 'date'],
      description: ['description', 'transaction description', 'reference', 'comments'],
      payee: ['payee', 'supplier', 'customer', 'party name'],
      debit: ['debit', 'withdrawal', 'outflow'],
      credit: ['credit', 'deposit', 'inflow'],
      amount: ['amount', 'transaction amount', 'signed amount'],
      bankAccountName: ['bank account name', 'bank name', 'account name'],
      accountNumberMasked: ['bank account number', 'account number', 'masked account'],
      currency: ['currency'],
    },
  },
  {
    id: 'onec',
    signConvention: 'signed_negative_in',
    scoreHeaders: (h) =>
      scoreAny(h, ['1c', '1с', 'контрагент', 'сумма', 'дата', 'назначение', 'плательщик']),
    aliases: {
      transactionDate: ['date', 'дата', 'transaction date', 'дата операции'],
      description: ['description', 'назначение платежа', 'назначение', 'комментарий'],
      payee: ['payee', 'контрагент', 'плательщик', 'получатель'],
      amount: ['amount', 'сумма', 'sum', 'transaction amount'],
      bankAccountName: ['bank account', 'счет', 'расчетный счет', 'bank account name'],
      accountNumberMasked: ['account number', 'номер счета', 'счет'],
      currency: ['currency', 'валюта'],
    },
  },
  {
    id: 'paycom',
    signConvention: 'signed_negative_in',
    scoreHeaders: (h) => scoreAny(h, ['pay.com', 'paycom', 'payout', 'beneficiary']),
    aliases: {
      transactionDate: ['date', 'transaction date', 'payment date', 'value date'],
      description: ['description', 'reference', 'payment reference', 'memo'],
      payee: ['payee', 'beneficiary', 'recipient', 'counterparty'],
      amount: ['amount', 'payment amount', 'transaction amount', 'value'],
      direction: ['direction', 'type', 'payment type', 'dr cr'],
      bankAccountName: ['bank account', 'account name', 'source account'],
      accountNumberMasked: ['account number', 'iban', 'masked account'],
      currency: ['currency'],
    },
  },
];

function resolveMapping(headers: string[], aliases: ColumnAliasLists): BankColumnMapping {
  const resolved: BankColumnMapping = {};
  for (const [key, list] of Object.entries(aliases) as [keyof BankColumnMapping, string[]][]) {
    if (!list?.length) continue;
    resolved[key] = findColumn(headers, list);
  }
  return { ...buildGenericMapping(headers), ...resolved };
}

function buildGenericMapping(headers: string[]): BankColumnMapping {
  return {
    bankAccountName: findColumn(headers, ['bank account name', 'account name', 'account', 'bank']),
    accountNumberMasked: findColumn(headers, [
      'account number masked',
      'account number',
      'iban',
      'masked account',
      'card number',
    ]),
    transactionDate: findColumn(headers, [
      'transaction date',
      'date',
      'posting date',
      'value date',
      'posted',
    ]),
    description: findColumn(headers, ['description', 'narrative', 'details', 'memo', 'reference']),
    payee: findColumn(headers, ['payee', 'merchant', 'counterparty', 'contact', 'vendor']),
    amount: findColumn(headers, ['amount', 'transaction amount', 'value', 'sum']),
    debit: findColumn(headers, ['debit', 'withdrawal', 'out', 'spent', 'payment']),
    credit: findColumn(headers, ['credit', 'deposit', 'in', 'received']),
    direction: findColumn(headers, ['direction', 'type', 'dr cr', 'in out', 'flow']),
    spent: findColumn(headers, ['spent', 'paid', 'payment amount']),
    received: findColumn(headers, ['received', 'deposited', 'deposit amount']),
    currency: findColumn(headers, ['currency', 'ccy']),
  };
}

function detectProfile(
  headers: string[],
  sourceHint: BankSourceFormat,
): { profile: FormatProfile; confidence: AiBankNormalizeResult['confidence'] } {
  const normalized = headers.map(normalizeHeader);
  if (sourceHint !== 'auto' && sourceHint !== 'generic') {
    const forced = FORMAT_PROFILES.find((p) => p.id === sourceHint);
    if (forced) return { profile: forced, confidence: 'high' };
  }

  let best = FORMAT_PROFILES[0];
  let bestScore = -1;
  for (const profile of FORMAT_PROFILES) {
    const score = profile.scoreHeaders(normalized);
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }

  const generic: FormatProfile = {
    id: 'generic',
    signConvention: 'signed_negative_in',
    scoreHeaders: () => 0,
    aliases: {},
  };

  if (bestScore < 15) {
    return { profile: generic, confidence: 'low' };
  }
  return { profile: best, confidence: bestScore >= 30 ? 'high' : 'medium' };
}

function parseDirectionColumn(raw: string | undefined): 'IN' | 'OUT' | null {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (['in', 'credit', 'cr', 'deposit', 'received', 'incoming', 'inflow'].some((t) => v.includes(t))) {
    return 'IN';
  }
  if (['out', 'debit', 'dr', 'payment', 'spent', 'withdrawal', 'outgoing', 'outflow'].some((t) => v.includes(t))) {
    return 'OUT';
  }
  return null;
}

function transformRow(
  record: Record<string, string>,
  mapping: BankColumnMapping,
  signConvention: BankSignConvention,
  defaults: FormatProfile['defaults'],
  warnings: Set<string>,
): UnifiedBankTransactionRow | null {
  const dateRaw = mapping.transactionDate ? record[mapping.transactionDate] : undefined;
  const transactionDate = parseDate(dateRaw);
  if (!transactionDate) return null;

  let direction: 'IN' | 'OUT' | null = null;
  let amount: number | null = null;

  if (signConvention === 'split_in_out_columns') {
    const spent = parseAmount(mapping.spent ? record[mapping.spent] : undefined);
    const received = parseAmount(mapping.received ? record[mapping.received] : undefined);
    if (received !== null && received > 0) {
      amount = received;
      direction = 'IN';
    } else if (spent !== null && spent > 0) {
      amount = spent;
      direction = 'OUT';
    }
  } else if (signConvention === 'debit_credit_columns') {
    const debit = parseAmount(mapping.debit ? record[mapping.debit] : undefined);
    const credit = parseAmount(mapping.credit ? record[mapping.credit] : undefined);
    if (credit !== null && credit > 0) {
      amount = credit;
      direction = 'IN';
    } else if (debit !== null && debit > 0) {
      amount = debit;
      direction = 'OUT';
    }
  } else if (mapping.direction && record[mapping.direction]) {
    direction = parseDirectionColumn(record[mapping.direction]);
    amount = parseAmount(mapping.amount ? record[mapping.amount] : undefined);
    if (amount !== null) amount = Math.abs(amount);
  } else {
    const rawAmount = parseAmount(mapping.amount ? record[mapping.amount] : undefined);
    if (rawAmount === null) return null;
    direction = inferDirectionFromSigned(rawAmount, signConvention);
    amount = Math.abs(rawAmount);
  }

  if (direction === null || amount === null || amount <= 0) return null;

  const payee = mapping.payee ? record[mapping.payee]?.trim() : undefined;
  const descriptionRaw = mapping.description ? record[mapping.description]?.trim() : undefined;
  const description = buildDescription(payee, descriptionRaw);

  const bankAccountName =
    (mapping.bankAccountName && record[mapping.bankAccountName]?.trim()) ||
    defaults?.bankAccountName ||
    'Imported Bank Account';
  const accountNumberMasked = maskAccount(
    mapping.accountNumberMasked ? record[mapping.accountNumberMasked] : undefined,
    defaults?.accountNumberMasked ?? '****0000',
  );

  if (!mapping.bankAccountName) {
    warnings.add('Bank account name column not found — using default account name.');
  }
  if (!mapping.accountNumberMasked) {
    warnings.add('Account number column not found — using masked placeholder.');
  }

  const currency =
    (mapping.currency && record[mapping.currency]?.trim().toUpperCase()) || defaults?.currency;

  return {
    bankAccountName,
    accountNumberMasked,
    transactionDate,
    description,
    payee,
    amount: round2(amount),
    direction,
    currency,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function unifiedToBankTransactionsRow(row: UnifiedBankTransactionRow): BankTransactionsRow {
  return {
    'Bank Account Name': row.bankAccountName,
    'Account Number Masked': row.accountNumberMasked,
    'Transaction Date': row.transactionDate,
    Description: row.description,
    Amount: row.amount,
    Direction: row.direction,
  };
}

export function normalizeBankUploadTable(
  table: RawTable,
  options: {
    sourceHint?: BankSourceFormat;
    defaultBankAccountName?: string;
    defaultAccountMasked?: string;
    defaultCurrency?: string;
    signConventionOverride?: BankSignConvention;
    aiMapping?: BankColumnMapping;
    aiSignConvention?: BankSignConvention;
  } = {},
): AiBankNormalizeResult {
  const headers = table.headers.filter((h) => h.trim().length > 0);
  const sourceHint = options.sourceHint ?? 'auto';
  const warnings = new Set<string>();

  let profile: FormatProfile;
  let confidence: AiBankNormalizeResult['confidence'];
  let mapping: BankColumnMapping;
  let signConvention: BankSignConvention;
  let source: AiBankNormalizeResult['source'] = 'rules';

  if (options.aiMapping) {
    mapping = { ...buildGenericMapping(headers), ...options.aiMapping };
    signConvention = options.aiSignConvention ?? 'signed_negative_in';
    profile = {
      id: 'generic',
      signConvention,
      scoreHeaders: () => 0,
      aliases: {},
      defaults: {
        bankAccountName: options.defaultBankAccountName,
        accountNumberMasked: options.defaultAccountMasked,
        currency: options.defaultCurrency,
      },
    };
    confidence = 'medium';
    source = 'ai';
  } else {
    const detected = detectProfile(headers, sourceHint);
    profile = detected.profile;
    confidence = detected.confidence;
    mapping = resolveMapping(headers, profile.aliases);
    signConvention = options.signConventionOverride ?? profile.signConvention;
  }

  if (profile.id === 'amex' && !options.signConventionOverride && !options.aiMapping) {
    signConvention = 'signed_positive_in';
    warnings.add('Amex-style export detected — positive amounts treated as charges (OUT).');
  }

  warnings.add(
    'Sign convention: negative/credit amounts → IN (money in); positive/debit amounts → OUT (money out), unless split debit/credit columns apply.',
  );

  const defaults = {
    bankAccountName: options.defaultBankAccountName ?? profile.defaults?.bankAccountName,
    accountNumberMasked: options.defaultAccountMasked ?? profile.defaults?.accountNumberMasked,
    currency: options.defaultCurrency ?? profile.defaults?.currency,
  };

  const unifiedRows: UnifiedBankTransactionRow[] = [];
  let skippedRows = 0;

  for (const cells of table.rows) {
    if (cells.every((c) => !c?.trim())) continue;
    const record = rowToRecord(headers, cells);
    const unified = transformRow(record, mapping, signConvention, defaults, warnings);
    if (!unified) {
      skippedRows += 1;
      continue;
    }
    unifiedRows.push(unified);
  }

  if (unifiedRows.length === 0) {
    warnings.add('No rows could be mapped — check date and amount columns or try a source hint.');
    confidence = 'low';
  }

  const previewRows = unifiedRows.slice(0, 50).map(unifiedToBankTransactionsRow);
  const canonicalCsv = buildBankTransactionsCsv(unifiedRows.map(unifiedToBankTransactionsRow));

  return {
    detectedFormat: options.aiMapping ? 'generic' : profile.id,
    signConvention,
    mapping,
    confidence,
    source,
    warnings: [...warnings],
    skippedRows,
    rowCount: unifiedRows.length,
    previewRows,
    canonicalCsv,
    unifiedRows,
  };
}

export function normalizeBankUploadCsv(
  csvContent: string,
  options?: Parameters<typeof normalizeBankUploadTable>[1],
): AiBankNormalizeResult {
  const parsed = parseCsv(csvContent.trim());
  if (parsed.headers.length === 0) {
    return {
      detectedFormat: 'generic',
      signConvention: 'signed_negative_in',
      mapping: {},
      confidence: 'low',
      source: 'rules',
      warnings: ['Could not parse CSV headers.'],
      skippedRows: 0,
      rowCount: 0,
      previewRows: [],
      canonicalCsv: buildBankTransactionsCsv([]),
      unifiedRows: [],
    };
  }
  return normalizeBankUploadTable(
    {
      headers: parsed.headers,
      rows: parsed.rows.map((row) => parsed.headers.map((h) => row[h] ?? '')),
    },
    options,
  );
}

export const BANK_SOURCE_FORMATS: BankSourceFormat[] = [
  'auto',
  'xero',
  'onec',
  'paycom',
  'sap',
  'oracle',
  'cba',
  'amex',
  'generic',
];
