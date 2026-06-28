import {
  buildBankTransactionsCsv,
  mergeAiBankNormalizeResults,
  normalizeBankUploadCsv,
  normalizeBankUploadTable,
} from './ai-bank-normalize';

describe('ai-bank-normalize', () => {
  it('maps signed amounts: negative IN, positive OUT', () => {
    const csv = [
      'Date,Description,Amount,Account Name,Account Number',
      '2026-01-10,Customer payment,-1500.00,Operating,1234567890',
      '2026-01-11,Supplier bill,250.50,Operating,1234567890',
    ].join('\n');

    const result = normalizeBankUploadCsv(csv, {
      defaultBankAccountName: 'Operating',
    });

    expect(result.rowCount).toBe(2);
    expect(result.previewRows[0].Direction).toBe('IN');
    expect(result.previewRows[0].Amount).toBe(1500);
    expect(result.previewRows[1].Direction).toBe('OUT');
    expect(result.previewRows[1].Amount).toBe(250.5);
  });

  it('maps Xero spent/received columns', () => {
    const result = normalizeBankUploadTable(
      {
        headers: ['Date', 'Payee', 'Description', 'Spent', 'Received'],
        rows: [
          ['2026-02-01', 'Acme Ltd', 'Invoice 100', '400', ''],
          ['2026-02-02', 'Client Co', 'Payment', '', '1200'],
        ],
      },
      { sourceHint: 'xero', defaultBankAccountName: 'Xero Main' },
    );

    expect(result.rowCount).toBe(2);
    expect(result.previewRows[0].Direction).toBe('OUT');
    expect(result.previewRows[1].Direction).toBe('IN');
    expect(result.previewRows[1].Description).toContain('Client Co');
  });

  it('maps SAP debit/credit columns', () => {
    const result = normalizeBankUploadTable(
      {
        headers: ['Posting Date', 'Text', 'Debit', 'Credit', 'House Bank'],
        rows: [
          ['2026-03-01', 'Vendor payment', '500', '', 'Main Bank'],
          ['2026-03-02', 'Customer receipt', '', '800', 'Main Bank'],
        ],
      },
      { sourceHint: 'sap' },
    );

    expect(result.previewRows[0].Direction).toBe('OUT');
    expect(result.previewRows[1].Direction).toBe('IN');
  });

  it('builds canonical CSV with exact headers', () => {
    const csv = buildBankTransactionsCsv([
      {
        'Bank Account Name': 'Main',
        'Account Number Masked': '****1234',
        'Transaction Date': '2026-01-01',
        Description: 'Test',
        Amount: 10,
        Direction: 'IN',
      },
    ]);
    expect(csv.split('\n')[0]).toBe(
      'Bank Account Name,Account Number Masked,Transaction Date,Description,Amount,Direction',
    );
  });

  it('merges multiple normalized file results', () => {
    const first = normalizeBankUploadCsv(
      'Date,Description,Amount\n2026-01-01,Payment A,-100\n',
      { defaultBankAccountName: 'Main' },
    );
    const second = normalizeBankUploadCsv(
      'Date,Description,Amount\n2026-01-02,Payment B,50\n',
      { defaultBankAccountName: 'Main' },
    );

    const merged = mergeAiBankNormalizeResults([first, second], {
      fileNames: ['a.csv', 'b.csv'],
    });

    expect(merged.rowCount).toBe(2);
    expect(merged.warnings[0]).toContain('Merged 2 file(s)');
  });
});
