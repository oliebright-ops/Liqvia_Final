import { readFileSync } from 'fs';
import { join } from 'path';
import { UploadValidationService } from './upload-validation.service';

describe('UploadValidationService', () => {
  const service = new UploadValidationService();
  const samplesDir = join(__dirname, '..', '..', '..', 'samples');

  it('validates trial balance sample from disk', () => {
    const csv = readFileSync(join(samplesDir, 'trial-balance-sample.csv'), 'utf-8');
    const result = service.validate('trial_balance', csv);
    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(3);
  });

  it('returns user-friendly errors for invalid trial balance row', () => {
    const csv = `Period,Account Code,Account Name,Account Type,Debit,Credit
2026-01,1000,Cash,asset,0,0`;
    const result = service.validate('trial_balance', csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].row).toBe(2);
  });
});
