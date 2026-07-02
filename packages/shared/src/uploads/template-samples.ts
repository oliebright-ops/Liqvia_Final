import * as XLSX from 'xlsx';
import { getFutureWeekPeriods, getPastWeekPeriods } from '../rolling-budget';
import { UPLOAD_TEMPLATES } from './templates';
import type { UploadTemplateType } from './types';

/** Template types shown in upload centre and onboarding (excludes legacy budget). */
export const UPLOAD_LIBRARY_TEMPLATE_TYPES = (
  Object.keys(UPLOAD_TEMPLATES) as UploadTemplateType[]
).filter((type) => type !== 'budget');

const STATIC_SAMPLE_ROWS: Partial<Record<UploadTemplateType, string[][]>> = {
  trial_balance: [
    ['2026-01', '1000', 'Cash', 'asset', '50000', '0'],
    ['2026-01', '4000', 'Revenue', 'revenue', '0', '120000'],
    ['2026-01', '5000', 'Payroll', 'expense', '45000', '0'],
  ],
  ar_ageing: [
    ['Acme Corp', 'INV-1001', '2026-01-15', '2026-02-14', '15000', 'USD'],
    ['Beta LLC', 'INV-1002', '2025-12-01', '2025-12-31', '8500', 'USD'],
  ],
  ap_ageing: [
    ['Payroll Provider', 'PAY-01', '2026-01-01', '2026-01-15', '22000', 'payroll', 'USD'],
    ['Office Supplies Co', 'BILL-44', '2026-01-10', '2026-02-09', '1200', 'flexible', 'USD'],
  ],
  bank_balances: [
    ['Operating Account', '****4521', 'USD', '2026-01-31', '48500'],
    ['Reserve Account', '****8832', 'USD', '2026-01-31', '12000'],
  ],
  bank_transactions: [
    ['Operating Account', '****4521', '2026-01-05', 'Customer payment INV-1001', '15000', 'IN'],
    ['Operating Account', '****4521', '2026-01-08', 'Payroll run January', '11000', 'OUT'],
    ['Operating Account', '****4521', '2026-01-12', 'Supplier materials invoice', '4200', 'OUT'],
    ['Reserve Account', '****8832', '2026-01-10', 'Internal transfer from operating', '5000', 'IN'],
  ],
};

function buildPastWeekSampleRows(
  templateType: 'weekly_actuals' | 'prior_period_budget' | 'budget',
  periods: string[],
): string[][] {
  const rows: string[][] = [];
  for (const period of periods) {
    if (templateType === 'weekly_actuals') {
      rows.push([period, 'revenue', '', '24000']);
      rows.push([period, 'payroll', '5000', '10800']);
      rows.push([period, 'expenses', '', '7900']);
    } else if (templateType === 'budget') {
      rows.push([period, 'revenue', '4000', '25000', 'operating']);
      rows.push([period, 'payroll', '5000', '11000', 'operating']);
      rows.push([period, 'expenses', '', '8000', 'operating']);
    } else {
      rows.push([period, 'revenue', '4000', '25000']);
      rows.push([period, 'payroll', '5000', '11000']);
      rows.push([period, 'expenses', '', '8000']);
    }
  }
  return rows;
}

function buildFutureWeekSampleRows(periods: string[]): string[][] {
  const rows: string[][] = [];
  for (const period of periods) {
    rows.push([period, 'revenue', '4000', '26000']);
    rows.push([period, 'payroll', '5000', '11200']);
    rows.push([period, 'expenses', '', '8200']);
  }
  return rows;
}

function sampleRowsForTemplate(templateType: UploadTemplateType, asOfDate: string): string[][] {
  if (
    templateType === 'weekly_actuals' ||
    templateType === 'prior_period_budget' ||
    templateType === 'budget'
  ) {
    return buildPastWeekSampleRows(templateType, getPastWeekPeriods(asOfDate));
  }
  if (templateType === 'rolling_budget') {
    return buildFutureWeekSampleRows(getFutureWeekPeriods(asOfDate));
  }
  return STATIC_SAMPLE_ROWS[templateType] ?? [];
}

export function buildTemplateSampleCsv(
  templateType: UploadTemplateType,
  asOfDate = new Date().toISOString().slice(0, 10),
): string {
  const template = UPLOAD_TEMPLATES[templateType];
  const rows = sampleRowsForTemplate(templateType, asOfDate);
  const lines = [template.headers.join(',')];
  for (const row of rows) {
    lines.push(row.join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function getTemplateSampleFileName(
  templateType: UploadTemplateType,
  format: 'csv' | 'xlsx',
): string {
  const base = UPLOAD_TEMPLATES[templateType].sampleFileName.replace(/\.csv$/i, '');
  return format === 'csv' ? `${base}.csv` : `${base}.xlsx`;
}

export function buildTemplateSampleXlsx(
  templateType: UploadTemplateType,
  asOfDate = new Date().toISOString().slice(0, 10),
): Uint8Array {
  const template = UPLOAD_TEMPLATES[templateType];
  const rows = sampleRowsForTemplate(templateType, asOfDate);
  const sheetData = [Array.from(template.headers), ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = template.headers.map((header) => ({
    wch: Math.max(header.length + 2, 14),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
