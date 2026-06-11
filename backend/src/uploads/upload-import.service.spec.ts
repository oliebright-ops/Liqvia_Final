import { UploadImportService } from './upload-import.service';
import { UploadValidationService } from './upload-validation.service';
import { PrismaService } from '../prisma/prisma.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';

describe('UploadImportService', () => {
  const prisma = new PrismaService();
  const engineStub = {
    recalculateAfterUpload: jest.fn().mockResolvedValue(undefined),
  } as unknown as TreasuryEngineService;
  const service = new UploadImportService(prisma, new UploadValidationService(), engineStub);

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: 'demo-consulting' },
      update: {},
      create: { id: 'demo-consulting', name: 'Demo Consulting Ltd', currency: 'USD' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('imports valid bank transaction rows', async () => {
    const csv = `Bank Account Name,Account Number Masked,Transaction Date,Description,Amount,Direction
Txn Test Account,****9999,2026-01-15,Test supplier payment,2500,OUT`;
    const result = await service.importCsv({
      templateType: 'bank_transactions',
      csvContent: csv,
      fileName: 'test-txn.csv',
      companyId: 'demo-consulting',
      companyCurrency: 'USD',
    });
    expect(result.status).toBe('completed');
    expect(result.rowCount).toBe(1);
  });

  it('imports valid AR ageing rows', async () => {
    const id = `INV-TEST-${Date.now()}`;
    const csv = `Customer Name,Invoice Number,Invoice Date,Due Date,Outstanding Amount,Currency
Test Co,${id},2026-01-15,2026-02-14,1500,USD`;
    const result = await service.importCsv({
      templateType: 'ar_ageing',
      csvContent: csv,
      fileName: 'test-ar.csv',
      companyId: 'demo-consulting',
      companyCurrency: 'USD',
    });
    expect(result.status).toBe('completed');
    expect(result.rowCount).toBe(1);
  });
});
