import { readFileSync } from 'fs';
import { join } from 'path';
import { UploadValidationService } from './upload-validation.service';

describe('Upload validation (integration)', () => {
  const service = new UploadValidationService();
  const samplesDir = join(__dirname, '..', '..', '..', 'samples');

  const cases: Array<[Parameters<UploadValidationService['validate']>[0], string, number]> = [
    ['trial_balance', 'trial-balance-sample.csv', 3],
    ['ar_ageing', 'ar-ageing-sample.csv', 2],
    ['ap_ageing', 'ap-ageing-sample.csv', 2],
    ['bank_balances', 'bank-balances-sample.csv', 2],
    ['budget', 'budget-sample.csv', 3],
  ];

  it.each(cases)('accepts valid %s sample', (type, file, rowCount) => {
    const csv = readFileSync(join(samplesDir, file), 'utf-8');
    const result = service.validate(type, csv);
    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(rowCount);
  });

  it('rejects wrong headers with clear message', () => {
    const result = service.validate('trial_balance', 'Bad,Header\nx,y');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/Column 1 must be|Expected 6 columns/);
  });

  it('rejects due date before invoice date', () => {
    const csv = `Customer Name,Invoice Number,Invoice Date,Due Date,Outstanding Amount,Currency
Acme,INV-1,2026-02-01,2026-01-01,100,USD`;
    const result = service.validate('ar_ageing', csv);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Due Date'))).toBe(true);
  });

  it('normalizes non-essential supplier priority', () => {
    const csv = `Supplier Name,Bill Number,Bill Date,Due Date,Outstanding Amount,Supplier Priority,Currency
Vendor,B-1,2026-01-01,2026-02-01,500,non-essential,USD`;
    const result = service.validate('ap_ageing', csv);
    expect(result.valid).toBe(true);
    expect((result.rows?.[0] as Record<string, string>)['Supplier Priority']).toBe('non_essential');
  });
});
