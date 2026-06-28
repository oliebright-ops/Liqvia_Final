import { describe, expect, it } from 'vitest';
import { parseCsv } from '../csv/parse-csv';
import { pdfTextToCsv } from './pdf-text-to-csv';

describe('pdfTextToCsv', () => {
  it('parses a space-aligned bank statement table', () => {
    const text = `
CommBank Business Transaction Listing
Account: Operating ****4821

Date        Description              Debit     Credit    Balance
01/06/2026  Office rent payment      1,250.00            18,420.00
02/06/2026  Client payment ABC Pty             3,400.00  21,820.00
03/06/2026  Stripe payout                        890.50  22,710.50

Closing balance                                              22,710.50
`;

    const result = pdfTextToCsv(text);
    expect(result.confidence).not.toBe('low');
    expect(result.rowCount).toBe(3);

    const parsed = parseCsv(result.csv);
    expect(parsed.headers.map((h) => h.toLowerCase())).toEqual(
      expect.arrayContaining(['date', 'description', 'debit', 'credit', 'balance']),
    );
    expect(parsed.rows[0]?.description).toContain('Office rent');
  });

  it('parses tab-separated export text', () => {
    const text = [
      'Transaction Date\tPayee\tAmount\tBalance',
      '2026-06-01\tAcme Supplies\t-450.00\t9550.00',
      '2026-06-02\tCustomer receipt\t1200.00\t10750.00',
    ].join('\n');

    const result = pdfTextToCsv(text);
    expect(result.rowCount).toBe(2);
    expect(result.csv).toContain('Transaction Date');
  });

  it('returns low confidence when no table is found', () => {
    const result = pdfTextToCsv('This PDF only contains a cover letter with no transactions.');
    expect(result.confidence).toBe('low');
    expect(result.rowCount).toBe(0);
    expect(result.csv).toBe('');
  });
});
