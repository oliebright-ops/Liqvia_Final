import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCsv } from '../csv/parse-csv';
import { isSupportedSpreadsheetFileName, spreadsheetToCsvString } from './parse-spreadsheet';

describe('spreadsheetToCsvString', () => {
  it('passes through CSV text', () => {
    const csv = 'period,category,amount\n2026-W01,revenue,1000\n';
    expect(spreadsheetToCsvString(csv, 'budget.csv')).toBe(csv);
  });

  it('converts xlsx buffer to CSV with expected headers', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['period', 'category', 'amount'],
      ['2026-W01', 'revenue', 1000],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const csv = spreadsheetToCsvString(buffer, 'budget.xlsx');
    const parsed = parseCsv(csv);

    expect(parsed.headers).toEqual(['period', 'category', 'amount']);
    expect(parsed.rows[0]).toEqual({ period: '2026-W01', category: 'revenue', amount: '1000' });
  });

  it('recognizes supported file extensions', () => {
    expect(isSupportedSpreadsheetFileName('data.csv')).toBe(true);
    expect(isSupportedSpreadsheetFileName('data.XLSX')).toBe(true);
    expect(isSupportedSpreadsheetFileName('data.xls')).toBe(true);
    expect(isSupportedSpreadsheetFileName('data.pdf')).toBe(false);
  });
});
