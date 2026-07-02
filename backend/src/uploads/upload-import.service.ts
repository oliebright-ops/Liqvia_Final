import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  UPLOAD_TEMPLATE_TYPES,
  buildRollingBudgetFromPrior,
  buildRollingBudgetLines,
  getFutureWeekPeriods,
  getPastWeekPeriods,
  periodToWeekStart,
  type WeeklyAmountRow,
} from '@liqvia2/shared';
import type { UploadTemplateType as SharedUploadTemplateType } from '@liqvia2/shared';
import {
  AccountType,
  BudgetCategory,
  SupplierPriority,
  UploadBatchStatus,
  UploadTemplateType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { UploadValidationService } from './upload-validation.service';

@Injectable()
export class UploadImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: UploadValidationService,
    private readonly engine: TreasuryEngineService,
  ) {}

  async importCsv(params: {
    templateType: UploadTemplateType;
    csvContent: string;
    fileName: string;
    companyId?: string;
    companyCurrency?: string;
  }) {
    if (!params.companyId) {
      throw new BadRequestException('Company workspace is required');
    }
    const companyId = params.companyId;
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new BadRequestException('Company not found');
    }

    const currency = company.currency;
    if (params.templateType === 'expense_report') {
      throw new BadRequestException(
        'Expense report uploads are no longer supported. Use Weekly Actuals or bank transactions instead.',
      );
    }
    const validation = this.validation.validate(
      params.templateType as SharedUploadTemplateType,
      params.csvContent,
      {
        companyCurrency: currency,
      },
    );

    if (!validation.valid || !validation.rows) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const batch = await this.prisma.uploadBatch.create({
      data: {
        companyId,
        templateType: params.templateType,
        fileName: params.fileName,
        status: UploadBatchStatus.importing,
        rowCount: validation.rowCount,
      },
    });

    try {
      await this.replaceExistingSnapshot(companyId, params.templateType, validation.rows);
      await this.persistRows(companyId, params.templateType, validation.rows, batch.id);
      if (
        params.templateType === 'weekly_actuals' ||
        params.templateType === 'prior_period_budget' ||
        params.templateType === 'budget'
      ) {
        await this.syncRollingBudgetIfNeeded(companyId);
      }
      await this.prisma.uploadBatch.update({
        where: { id: batch.id },
        data: {
          status: UploadBatchStatus.completed,
          rowSnapshot: validation.rows as Prisma.InputJsonValue,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          companyId,
          action: 'upload.import',
          entityType: 'UploadBatch',
          entityId: batch.id,
          metadata: { templateType: params.templateType, rowCount: validation.rowCount },
        },
      });
    } catch (err) {
      await this.prisma.uploadBatch.update({
        where: { id: batch.id },
        data: { status: UploadBatchStatus.failed },
      });
      throw err;
    }

    await this.engine.recalculateAfterUpload(companyId);

    return {
      batchId: batch.id,
      status: 'completed',
      rowCount: validation.rowCount,
      summary: `Imported ${validation.rowCount} row(s) successfully.`,
    };
  }

  async listBatches(companyId: string) {
    const batches = await this.prisma.uploadBatch.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        templateType: true,
        fileName: true,
        status: true,
        rowCount: true,
        createdAt: true,
        rowSnapshot: true,
      },
    });
    return batches.map(({ rowSnapshot, ...batch }) => ({
      ...batch,
      hasSnapshot: rowSnapshot != null,
    }));
  }

  async getBatch(companyId: string, batchId: string) {
    const batch = await this.prisma.uploadBatch.findFirst({
      where: { id: batchId, companyId },
    });
    if (!batch) {
      throw new NotFoundException('Upload batch not found');
    }
    const rows = Array.isArray(batch.rowSnapshot) ? batch.rowSnapshot : [];
    return {
      id: batch.id,
      templateType: batch.templateType,
      fileName: batch.fileName,
      status: batch.status,
      rowCount: batch.rowCount,
      createdAt: batch.createdAt,
      hasSnapshot: rows.length > 0,
      rows,
    };
  }

  async getLatestByType(companyId: string) {
    const latest = await Promise.all(
      UPLOAD_TEMPLATE_TYPES.map(async (templateType) => {
        const batch = await this.prisma.uploadBatch.findFirst({
          where: {
            companyId,
            templateType,
            status: UploadBatchStatus.completed,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            templateType: true,
            fileName: true,
            rowCount: true,
            createdAt: true,
          },
        });
        return batch ? { ...batch, isLatest: true } : null;
      }),
    );
    return latest.filter((b): b is NonNullable<typeof b> => b !== null);
  }

  /** Remove live data for one template type; upload batch snapshots are kept. */
  async clearActiveDataForTemplate(companyId: string, templateType: UploadTemplateType) {
    await this.clearLiveDataForTemplate(companyId, templateType);
    if (
      templateType === 'weekly_actuals' ||
      templateType === 'prior_period_budget' ||
      templateType === 'budget'
    ) {
      await this.syncRollingBudgetIfNeeded(companyId);
    }
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'upload.clear_active',
        entityType: 'UploadTemplateType',
        entityId: templateType,
      },
    });
    await this.engine.recalculateAfterUpload(companyId);
    const label = templateType.replace(/_/g, ' ');
    return {
      cleared: true,
      templateType,
      summary: `Live ${label} data cleared. Upload history retained — re-import or restore from a prior upload.`,
    };
  }

  /**
   * Delete one upload batch. If it is the latest completed import for its type,
   * live data is cleared and the previous completed snapshot is restored when available.
   */
  async deleteBatch(companyId: string, batchId: string) {
    const batch = await this.prisma.uploadBatch.findFirst({
      where: { id: batchId, companyId },
    });
    if (!batch) {
      throw new NotFoundException('Upload batch not found');
    }

    const latest = await this.prisma.uploadBatch.findFirst({
      where: {
        companyId,
        templateType: batch.templateType,
        status: UploadBatchStatus.completed,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const isLatest = latest?.id === batchId;
    let restoredFromBatchId: string | undefined;

    if (isLatest && batch.status === UploadBatchStatus.completed) {
      await this.clearLiveDataForTemplate(companyId, batch.templateType);

      const previous = await this.prisma.uploadBatch.findFirst({
        where: {
          companyId,
          templateType: batch.templateType,
          status: UploadBatchStatus.completed,
          id: { not: batchId },
          rowSnapshot: { not: Prisma.DbNull },
        },
        orderBy: { createdAt: 'desc' },
      });

      const previousRows = Array.isArray(previous?.rowSnapshot) ? previous.rowSnapshot : [];
      if (previous && previousRows.length > 0) {
        await this.persistRows(companyId, batch.templateType, previousRows, previous.id);
        restoredFromBatchId = previous.id;
        if (
          batch.templateType === 'weekly_actuals' ||
          batch.templateType === 'prior_period_budget' ||
          batch.templateType === 'budget'
        ) {
          await this.syncRollingBudgetIfNeeded(companyId);
        }
      }
    } else if (batch.status === UploadBatchStatus.completed) {
      await this.deleteBatchLinkedRecords(batch.templateType, batchId);
    }

    await this.prisma.uploadBatch.delete({ where: { id: batchId } });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'upload.delete_batch',
        entityType: 'UploadBatch',
        entityId: batchId,
        metadata: {
          templateType: batch.templateType,
          fileName: batch.fileName,
          restoredFromBatchId,
        },
      },
    });

    await this.engine.recalculateAfterUpload(companyId);

    const summary = restoredFromBatchId
      ? `Deleted "${batch.fileName}" and restored the previous ${batch.templateType.replace(/_/g, ' ')} upload.`
      : isLatest
        ? `Deleted "${batch.fileName}" and cleared live ${batch.templateType.replace(/_/g, ' ')} data.`
        : `Deleted upload "${batch.fileName}" from history.`;

    return {
      deleted: true,
      batchId,
      templateType: batch.templateType,
      restoredFromBatchId,
      summary,
    };
  }

  /** Clear live financial data while retaining upload batch snapshots for reference. */
  async wipeCompanyData(companyId: string) {
    await this.prisma.scenarioLine.deleteMany({ where: { scenario: { companyId } } });
    await this.prisma.scenario.deleteMany({ where: { companyId } });
    await this.prisma.forecastLine.deleteMany({ where: { cashForecast: { companyId } } });
    await this.prisma.cashForecast.deleteMany({ where: { companyId } });
    await this.prisma.alert.deleteMany({ where: { companyId } });
    await this.prisma.aiInsight.deleteMany({ where: { companyId } });
    await this.prisma.receivable.deleteMany({ where: { companyId } });
    await this.prisma.payable.deleteMany({ where: { companyId } });
    await this.prisma.cashMovement.deleteMany({ where: { companyId } });
    await this.prisma.bankAccount.deleteMany({ where: { companyId } });
    await this.prisma.journalLine.deleteMany({ where: { journalEntry: { companyId } } });
    await this.prisma.journalEntry.deleteMany({ where: { companyId } });
    await this.prisma.budgetLine.deleteMany({ where: { budget: { companyId } } });
    await this.prisma.budget.deleteMany({ where: { companyId } });
    await this.prisma.chartOfAccount.deleteMany({ where: { companyId } });
    await this.prisma.weeklyActual.deleteMany({ where: { companyId } });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'upload.wipe',
        entityType: 'Company',
        entityId: companyId,
        metadata: { retainedUploadBatches: true },
      },
    });

    await this.engine.recalculateAfterUpload(companyId);

    return {
      cleared: true,
      summary: 'All live financial data cleared. Upload history retained for reference.',
    };
  }

  /** Replace prior snapshot data so re-uploads refresh dashboards instead of duplicating. */
  private async replaceExistingSnapshot(
    companyId: string,
    templateType: UploadTemplateType,
    rows: unknown[],
  ) {
    if (templateType === 'trial_balance') {
      const periods = [
        ...new Set((rows as Array<Record<string, unknown>>).map((r) => String(r.Period))),
      ];
      if (periods.length === 0) return;
      const entries = await this.prisma.journalEntry.findMany({
        where: { companyId, period: { in: periods } },
        select: { id: true },
      });
      const entryIds = entries.map((e) => e.id);
      if (entryIds.length > 0) {
        await this.prisma.journalLine.deleteMany({
          where: { journalEntryId: { in: entryIds } },
        });
        await this.prisma.journalEntry.deleteMany({ where: { id: { in: entryIds } } });
      }
      return;
    }

    await this.clearLiveDataForTemplate(companyId, templateType);
  }

  private async clearLiveDataForTemplate(companyId: string, templateType: UploadTemplateType) {
    switch (templateType) {
      case 'ar_ageing':
        await this.prisma.receivable.deleteMany({ where: { companyId } });
        break;
      case 'ap_ageing':
        await this.prisma.payable.deleteMany({ where: { companyId } });
        break;
      case 'bank_balances':
        await this.prisma.cashMovement.deleteMany({
          where: { companyId, description: 'Balance upload' },
        });
        break;
      case 'bank_transactions':
        await this.prisma.cashMovement.deleteMany({
          where: {
            companyId,
            description: { notIn: ['Balance upload', 'Opening cash balance'] },
          },
        });
        break;
      case 'budget':
      case 'prior_period_budget': {
        const pastPeriods = getPastWeekPeriods(new Date().toISOString().slice(0, 10));
        const year = new Date().getFullYear();
        const budget = await this.prisma.budget.findFirst({
          where: { companyId, fiscalYear: year },
        });
        if (budget) {
          await this.prisma.budgetLine.deleteMany({
            where: {
              budgetId: budget.id,
              period: { in: pastPeriods },
              budgetType: { in: ['prior', 'operating'] },
            },
          });
        }
        break;
      }
      case 'rolling_budget': {
        const futurePeriods = getFutureWeekPeriods(new Date().toISOString().slice(0, 10));
        const year = new Date().getFullYear();
        const budget = await this.prisma.budget.findFirst({
          where: { companyId, fiscalYear: year },
        });
        if (budget) {
          await this.prisma.budgetLine.deleteMany({
            where: {
              budgetId: budget.id,
              period: { in: futurePeriods },
              budgetType: 'rolling',
            },
          });
        }
        break;
      }
      case 'weekly_actuals': {
        const priorBatches = await this.prisma.uploadBatch.findMany({
          where: { companyId, templateType: 'weekly_actuals', status: UploadBatchStatus.completed },
          select: { id: true },
        });
        if (priorBatches.length > 0) {
          await this.prisma.weeklyActual.deleteMany({
            where: { companyId, uploadBatchId: { in: priorBatches.map((b) => b.id) } },
          });
        }
        break;
      }
      case 'expense_report': {
        const priorBatches = await this.prisma.uploadBatch.findMany({
          where: { companyId, templateType: 'expense_report', status: UploadBatchStatus.completed },
          select: { id: true },
        });
        if (priorBatches.length > 0) {
          await this.prisma.weeklyActual.deleteMany({
            where: { companyId, uploadBatchId: { in: priorBatches.map((b) => b.id) } },
          });
        }
        break;
      }
      case 'trial_balance':
        await this.prisma.journalLine.deleteMany({ where: { journalEntry: { companyId } } });
        await this.prisma.journalEntry.deleteMany({ where: { companyId } });
        break;
    }
  }

  private async deleteBatchLinkedRecords(templateType: UploadTemplateType, batchId: string) {
    switch (templateType) {
      case 'ar_ageing':
        await this.prisma.receivable.deleteMany({ where: { uploadBatchId: batchId } });
        break;
      case 'ap_ageing':
        await this.prisma.payable.deleteMany({ where: { uploadBatchId: batchId } });
        break;
      case 'weekly_actuals':
        await this.prisma.weeklyActual.deleteMany({ where: { uploadBatchId: batchId } });
        break;
      case 'expense_report':
        await this.prisma.weeklyActual.deleteMany({ where: { uploadBatchId: batchId } });
        break;
      default:
        break;
    }
  }

  private async persistRows(
    companyId: string,
    templateType: UploadTemplateType,
    rows: unknown[],
    uploadBatchId: string,
  ) {
    switch (templateType) {
      case 'ar_ageing':
        await this.persistReceivables(companyId, rows, uploadBatchId);
        break;
      case 'ap_ageing':
        await this.persistPayables(companyId, rows, uploadBatchId);
        break;
      case 'bank_balances':
        await this.persistBankBalances(companyId, rows);
        break;
      case 'bank_transactions':
        await this.persistBankTransactions(companyId, rows);
        break;
      case 'budget':
        await this.persistBudget(companyId, rows, 'prior');
        break;
      case 'prior_period_budget':
        await this.persistBudget(companyId, rows, 'prior');
        break;
      case 'rolling_budget':
        await this.persistBudget(companyId, rows, 'rolling');
        break;
      case 'trial_balance':
        await this.persistTrialBalance(companyId, rows);
        break;
      case 'weekly_actuals':
        await this.persistWeeklyActuals(companyId, rows, uploadBatchId);
        break;
      default:
        throw new BadRequestException(`Unsupported template: ${templateType}`);
    }
  }

  private async persistReceivables(companyId: string, rows: unknown[], uploadBatchId: string) {
    for (const row of rows as Array<Record<string, unknown>>) {
      await this.prisma.receivable.create({
        data: {
          companyId,
          customerName: String(row['Customer Name']),
          invoiceNumber: String(row['Invoice Number']),
          invoiceDate: new Date(String(row['Invoice Date'])),
          dueDate: new Date(String(row['Due Date'])),
          outstandingAmount: Number(row['Outstanding Amount']),
          currency: String(row.Currency),
          uploadBatchId,
        },
      });
    }
  }

  private async persistPayables(companyId: string, rows: unknown[], uploadBatchId: string) {
    for (const row of rows as Array<Record<string, unknown>>) {
      await this.prisma.payable.create({
        data: {
          companyId,
          supplierName: String(row['Supplier Name']),
          billNumber: String(row['Bill Number']),
          billDate: new Date(String(row['Bill Date'])),
          dueDate: new Date(String(row['Due Date'])),
          outstandingAmount: Number(row['Outstanding Amount']),
          supplierPriority: row['Supplier Priority'] as SupplierPriority,
          currency: String(row.Currency),
          uploadBatchId,
        },
      });
    }
  }

  private async persistBankBalances(companyId: string, rows: unknown[]) {
    for (const row of rows as Array<Record<string, unknown>>) {
      const name = String(row['Bank Account Name']);
      const masked = String(row['Account Number Masked']);
      const currency = String(row.Currency);
      const balanceDate = new Date(String(row['Balance Date']));
      const balance = Number(row['Current Balance']);

      const account = await this.resolveBankAccount(companyId, name, masked, currency);

      await this.prisma.cashMovement.create({
        data: {
          companyId,
          bankAccountId: account.id,
          movementDate: balanceDate,
          amount: balance,
          isInflow: balance >= 0,
          description: 'Balance upload',
        },
      });
    }
  }

  private async persistBankTransactions(companyId: string, rows: unknown[]) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const currency = company?.currency ?? 'USD';

    for (const row of rows as Array<Record<string, unknown>>) {
      const name = String(row['Bank Account Name']);
      const masked = String(row['Account Number Masked']);
      const movementDate = new Date(String(row['Transaction Date']));
      const description = String(row.Description);
      const amount = Number(row.Amount);
      const direction = String(row.Direction).toUpperCase();
      const isInflow = direction === 'IN';

      const account = await this.resolveBankAccount(companyId, name, masked, currency);

      await this.prisma.cashMovement.create({
        data: {
          companyId,
          bankAccountId: account.id,
          movementDate,
          amount,
          isInflow,
          description,
        },
      });
    }
  }

  private async resolveBankAccount(
    companyId: string,
    name: string,
    masked: string,
    currency: string,
  ) {
    const existing = await this.prisma.bankAccount.findFirst({
      where: { companyId, name, accountNumberMasked: masked },
    });
    if (existing) return existing;

    return this.prisma.bankAccount.create({
      data: { companyId, name, accountNumberMasked: masked, currency },
    });
  }

  private async persistWeeklyActuals(companyId: string, rows: unknown[], uploadBatchId: string) {
    for (const row of rows as Array<Record<string, unknown>>) {
      const period = String(row.Period);
      const accountCode = String(row['Account Code'] ?? '').trim();
      await this.prisma.weeklyActual.create({
        data: {
          companyId,
          period,
          weekStart: new Date(`${periodToWeekStart(period)}T00:00:00.000Z`),
          category: row.Category as BudgetCategory,
          accountCode: accountCode || null,
          actualAmount: Number(row['Actual Amount']),
          uploadBatchId,
        },
      });
    }
  }

  /**
   * Auto-fill forward rolling budget only when the user has not uploaded one.
   * Prefers prior-period budget; falls back to recent actual averages.
   */
  private async syncRollingBudgetIfNeeded(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;

    const asOfDate = new Date().toISOString().slice(0, 10);
    const lookback = company.forecastLookbackWeeks ?? 4;
    const futurePeriods = getFutureWeekPeriods(asOfDate);
    const year = new Date().getFullYear();

    let budget = await this.prisma.budget.findFirst({
      where: { companyId, fiscalYear: year },
    });
    if (!budget) {
      budget = await this.prisma.budget.create({
        data: { companyId, name: `Budget ${year}`, fiscalYear: year },
      });
    }

    const userRolling = await this.prisma.budgetLine.findFirst({
      where: {
        budgetId: budget.id,
        budgetType: 'rolling',
        period: { in: futurePeriods },
      },
    });
    if (userRolling) return;

    const priorLines = await this.prisma.budgetLine.findMany({
      where: { budgetId: budget.id, budgetType: { in: ['prior', 'operating'] } },
    });

    let rollingLines: ReturnType<typeof buildRollingBudgetLines> = [];

    if (priorLines.length > 0) {
      const priorRows: WeeklyAmountRow[] = priorLines.map((l) => ({
        period: l.period,
        category: l.category,
        amount: Number(l.budgetAmount),
      }));
      rollingLines = buildRollingBudgetFromPrior(priorRows, lookback, asOfDate);
    } else {
      const actuals = await this.prisma.weeklyActual.findMany({ where: { companyId } });
      if (actuals.length === 0) return;
      const actualRows: WeeklyAmountRow[] = actuals.map((a) => ({
        period: a.period,
        category: a.category,
        amount: Number(a.actualAmount),
        accountCode: a.accountCode ?? undefined,
      }));
      rollingLines = buildRollingBudgetLines(actualRows, lookback, asOfDate);
    }

    await this.prisma.budgetLine.deleteMany({
      where: { budgetId: budget.id, budgetType: 'rolling_auto', period: { in: futurePeriods } },
    });

    for (const line of rollingLines) {
      await this.prisma.budgetLine.create({
        data: {
          budgetId: budget.id,
          period: line.period,
          category: line.category as BudgetCategory,
          budgetAmount: line.budgetAmount,
          budgetType: line.budgetType,
        },
      });
    }
  }

  private async persistBudget(companyId: string, rows: unknown[], budgetType: string) {
    const year = new Date().getFullYear();
    let budget = await this.prisma.budget.findFirst({
      where: { companyId, fiscalYear: year },
    });
    if (!budget) {
      budget = await this.prisma.budget.create({
        data: { companyId, name: `Budget ${year}`, fiscalYear: year },
      });
    }

    for (const row of rows as Array<Record<string, unknown>>) {
      const accountCode = String(row['Account Code'] ?? '');
      let chartOfAccountId: string | undefined;
      if (accountCode) {
        const coa = await this.prisma.chartOfAccount.findUnique({
          where: { companyId_code: { companyId, code: accountCode } },
        });
        chartOfAccountId = coa?.id;
      }

      await this.prisma.budgetLine.create({
        data: {
          budgetId: budget.id,
          period: String(row.Period),
          category: row.Category as BudgetCategory,
          chartOfAccountId,
          budgetAmount: Number(row['Budget Amount']),
          budgetType: String(row['Budget Type'] ?? budgetType),
        },
      });
    }
  }

  private async persistTrialBalance(companyId: string, rows: unknown[]) {
    const typedRows = rows as Array<Record<string, unknown>>;

    const byPeriod = new Map<string, Array<Record<string, unknown>>>();
    for (const row of typedRows) {
      const code = String(row['Account Code']);
      const period = String(row.Period);
      await this.prisma.chartOfAccount.upsert({
        where: { companyId_code: { companyId, code } },
        create: {
          companyId,
          code,
          name: String(row['Account Name']),
          accountType: row['Account Type'] as AccountType,
        },
        update: {
          name: String(row['Account Name']),
          accountType: row['Account Type'] as AccountType,
        },
      });
      const list = byPeriod.get(period) ?? [];
      list.push(row);
      byPeriod.set(period, list);
    }

    for (const [period, periodRows] of byPeriod) {
      const entry = await this.prisma.journalEntry.create({
        data: {
          companyId,
          period,
          entryDate: new Date(`${period}-01`),
          description: `Trial balance import ${period}`,
        },
      });

      for (const row of periodRows) {
        const code = String(row['Account Code']);
        const coa = await this.prisma.chartOfAccount.findUnique({
          where: { companyId_code: { companyId, code } },
        });
        if (!coa) continue;
        await this.prisma.journalLine.create({
          data: {
            journalEntryId: entry.id,
            chartOfAccountId: coa.id,
            debit: Number(row.Debit),
            credit: Number(row.Credit),
          },
        });
      }
    }
  }
}
