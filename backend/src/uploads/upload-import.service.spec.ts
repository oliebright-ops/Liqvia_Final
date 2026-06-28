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

  it('deletes latest upload and restores the previous snapshot', async () => {
    const suffix = Date.now();
    const firstCsv = `Customer Name,Invoice Number,Invoice Date,Due Date,Outstanding Amount,Currency
Restore Co,INV-RESTORE-A-${suffix},2026-01-15,2026-02-14,1000,USD`;
    const secondCsv = `Customer Name,Invoice Number,Invoice Date,Due Date,Outstanding Amount,Currency
Restore Co,INV-RESTORE-B-${suffix},2026-01-16,2026-02-15,2000,USD`;

    const first = await service.importCsv({
      templateType: 'ar_ageing',
      csvContent: firstCsv,
      fileName: 'restore-a.csv',
      companyId: 'demo-consulting',
      companyCurrency: 'USD',
    });
    await service.importCsv({
      templateType: 'ar_ageing',
      csvContent: secondCsv,
      fileName: 'restore-b.csv',
      companyId: 'demo-consulting',
      companyCurrency: 'USD',
    });

    const deleted = await service.deleteBatch('demo-consulting', first.batchId);
    expect(deleted.deleted).toBe(true);

    const remaining = await prisma.receivable.findMany({
      where: { companyId: 'demo-consulting', invoiceNumber: `INV-RESTORE-B-${suffix}` },
    });
    expect(remaining).toHaveLength(1);
  });

  it('deletes the latest upload and rolls back to the prior version', async () => {
    const suffix = Date.now();
    const firstCsv = `Customer Name,Invoice Number,Invoice Date,Due Date,Outstanding Amount,Currency
Rollback Co,INV-RB-A-${suffix},2026-01-15,2026-02-14,1000,USD`;
    const secondCsv = `Customer Name,Invoice Number,Invoice Date,Due Date,Outstanding Amount,Currency
Rollback Co,INV-RB-B-${suffix},2026-01-16,2026-02-15,2000,USD`;

    await service.importCsv({
      templateType: 'ar_ageing',
      csvContent: firstCsv,
      fileName: 'rollback-a.csv',
      companyId: 'demo-consulting',
      companyCurrency: 'USD',
    });
    const latest = await service.importCsv({
      templateType: 'ar_ageing',
      csvContent: secondCsv,
      fileName: 'rollback-b.csv',
      companyId: 'demo-consulting',
      companyCurrency: 'USD',
    });

    const deleted = await service.deleteBatch('demo-consulting', latest.batchId);
    expect(deleted.restoredFromBatchId).toBeDefined();

    const restored = await prisma.receivable.findMany({
      where: { companyId: 'demo-consulting', invoiceNumber: `INV-RB-A-${suffix}` },
    });
    expect(restored).toHaveLength(1);
  });
});
