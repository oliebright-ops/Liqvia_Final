import { UPLOAD_TEMPLATES, type UploadTemplateType } from '@liqvia2/shared';
import type { TranslateFn } from './i18n';

/** Maps canonical CSV header → upload.headers.* locale key suffix. */
const HEADER_LOCALE_KEYS: Record<string, string> = {
  Period: 'period',
  'Account Code': 'accountCode',
  'Account Name': 'accountName',
  'Account Type': 'accountType',
  Debit: 'debit',
  Credit: 'credit',
  'Customer Name': 'customerName',
  'Invoice Number': 'invoiceNumber',
  'Invoice Date': 'invoiceDate',
  'Due Date': 'dueDate',
  'Outstanding Amount': 'outstandingAmount',
  Currency: 'currency',
  'Supplier Name': 'supplierName',
  'Bill Number': 'billNumber',
  'Bill Date': 'billDate',
  'Supplier Priority': 'supplierPriority',
  'Bank Account Name': 'bankAccountName',
  'Account Number Masked': 'accountNumberMasked',
  'Balance Date': 'balanceDate',
  'Current Balance': 'currentBalance',
  'Transaction Date': 'transactionDate',
  Description: 'description',
  Amount: 'amount',
  Direction: 'direction',
  Category: 'category',
  'Budget Amount': 'budgetAmount',
  'Budget Type': 'budgetType',
  'Actual Amount': 'actualAmount',
  Payee: 'payee',
};

export function translateUploadTemplateLabel(type: UploadTemplateType, t: TranslateFn): string {
  const key = `upload.templates.${type}.label`;
  const translated = t(key);
  if (translated !== key) return translated;
  return UPLOAD_TEMPLATES[type]?.label ?? type;
}

export function translateUploadHeader(canonical: string, t: TranslateFn): string {
  const suffix = HEADER_LOCALE_KEYS[canonical];
  if (!suffix) return canonical;
  const key = `upload.headers.${suffix}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return canonical;
}

export function translateUploadHeaders(canonicalHeaders: readonly string[], t: TranslateFn): string[] {
  return canonicalHeaders.map((h) => translateUploadHeader(h, t));
}

export function formatRequiredColumnsUi(type: UploadTemplateType, t: TranslateFn): string {
  const canonical = UPLOAD_TEMPLATES[type].headers;
  const translated = translateUploadHeaders(canonical, t);
  return translated.join(', ');
}

export function formatRequiredColumnsFile(type: UploadTemplateType): string {
  return UPLOAD_TEMPLATES[type].headers.join(', ');
}

export function getUploadTemplateHeaders(type: UploadTemplateType): readonly string[] {
  return UPLOAD_TEMPLATES[type].headers;
}
