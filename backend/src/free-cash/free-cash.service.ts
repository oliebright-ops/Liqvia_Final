import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildFreeCashReport,
  clampForecastHorizon,
  computeAccountLedger,
  FreeCashReport,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FreeCashService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(companyId: string, horizonWeeksInput: number): Promise<FreeCashReport> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const horizonWeeks = clampForecastHorizon(horizonWeeksInput);
    const asOfDate = new Date().toISOString().slice(0, 10);

    const [bankAccounts, movements, receivables, payables, weeklyActuals] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.cashMovement.findMany({
        where: { companyId },
        orderBy: { movementDate: 'desc' },
      }),
      this.prisma.receivable.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.payable.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.weeklyActual.findMany({
        where: {
          companyId,
          NOT: {
            uploadBatch: {
              templateType: 'expense_report',
            },
          },
        },
      }),
    ]);

    const closingBalance = bankAccounts.reduce((sum, account) => {
      const accountMovements = movements
        .filter((m) => m.bankAccountId === account.id)
        .map((m) => ({
          id: m.id,
          bankAccountId: m.bankAccountId,
          movementDate: m.movementDate.toISOString(),
          amount: Number(m.amount),
          isInflow: m.isInflow,
          description: m.description,
        }));
      return sum + computeAccountLedger(accountMovements, asOfDate).closingBalance;
    }, 0);

    const payableInputs = payables.map((p) => ({
      id: p.id,
      counterparty: p.supplierName,
      dueDate: p.dueDate.toISOString().slice(0, 10),
      outstandingAmount: Number(p.outstandingAmount),
    }));

    const apOverdue = payableInputs
      .filter((p) => p.dueDate < asOfDate && p.outstandingAmount > 0)
      .reduce((s, p) => s + p.outstandingAmount, 0);

    return buildFreeCashReport(
      closingBalance,
      {
        asOfDate,
        openingCash: closingBalance,
        horizonWeeks,
        forecastLookbackWeeks: company.forecastLookbackWeeks,
        weeklyActuals:
          weeklyActuals.length > 0
            ? weeklyActuals.map((a) => ({
                period: a.period,
                category: a.category,
                amount: Number(a.actualAmount),
                accountCode: a.accountCode ?? undefined,
              }))
            : undefined,
        receivables: receivables.map((r) => ({
          id: r.id,
          counterparty: r.customerName,
          dueDate: r.dueDate.toISOString().slice(0, 10),
          outstandingAmount: Number(r.outstandingAmount),
        })),
        payables: payableInputs,
      },
      apOverdue,
      company.currency,
    );
  }
}
