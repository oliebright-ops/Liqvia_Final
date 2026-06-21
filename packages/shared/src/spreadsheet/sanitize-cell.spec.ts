import { sanitizeSpreadsheetCellValue } from './sanitize-cell';

describe('sanitizeSpreadsheetCellValue', () => {
  it('prefixes formula-like values', () => {
    expect(sanitizeSpreadsheetCellValue('=1+1')).toBe("'=1+1");
    expect(sanitizeSpreadsheetCellValue('+1234')).toBe("'+1234");
    expect(sanitizeSpreadsheetCellValue('-100')).toBe("'-100");
    expect(sanitizeSpreadsheetCellValue('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('leaves normal values unchanged', () => {
    expect(sanitizeSpreadsheetCellValue('Acme Corp')).toBe('Acme Corp');
    expect(sanitizeSpreadsheetCellValue('2026-01-15')).toBe('2026-01-15');
    expect(sanitizeSpreadsheetCellValue('USD')).toBe('USD');
  });
});
