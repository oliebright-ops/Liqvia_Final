import { Injectable, NotFoundException } from '@nestjs/common';
import { ObligationCategory } from '@prisma/client';
import { ApPaymentPriority, DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecurringObligationDto,
  UpdateRecurringObligationDto,
} from '../dto/recurring-obligation.dto';
import { projectOccurrences, rollForwardDueDate } from './occurrences';

/** How a recurring obligation's category maps onto AP payment priority for forecasting/advisory. */
const CATEGORY_TO_PRIORITY: Record<ObligationCategory, ApPaymentPriority> = {
  payroll: 'payroll',
  superannuation: 'tax',
  payg_withholding: 'tax',
  gst_bas: 'tax',
  tax: 'tax',
  rent: 'critical',
  loan_repayment: 'critical',
  insurance: 'flexible',
  utilities: 'critical',
  vehicle: 'flexible',
  merchant_fees: 'non_essential',
  subscription: 'non_essential',
  other: 'flexible',
};

export function priorityForCategory(category: ObligationCategory): ApPaymentPriority {
  return CATEGORY_TO_PRIORITY[category];
}

export interface SyntheticPayableRow {
  id: string;
  counterparty: string;
  outstandingAmount: number;
  billDate: string;
  dueDate: string;
  supplierPriority: ApPaymentPriority;
}

@Injectable()
export class RecurringObligationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string = DEFAULT_DEMO_COMPANY_ID) {
    return this.prisma.recurringObligation.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { nextDueDate: 'asc' },
    });
  }

  async create(companyId: string = DEFAULT_DEMO_COMPANY_ID, dto: CreateRecurringObligationDto) {
    return this.prisma.recurringObligation.create({
      data: {
        companyId,
        name: dto.name,
        category: dto.category,
        amount: dto.amount,
        frequency: dto.frequency,
        nextDueDate: new Date(`${dto.nextDueDate}T00:00:00.000Z`),
        notes: dto.notes ?? null,
        active: dto.active ?? true,
        paymentMethod: dto.paymentMethod ?? null,
        linkedBankAccountId: dto.linkedBankAccountId ?? null,
        confidence: dto.confidence ?? null,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateRecurringObligationDto,
  ) {
    const existing = await this.prisma.recurringObligation.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Recurring obligation not found');

    return this.prisma.recurringObligation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.nextDueDate !== undefined && {
          nextDueDate: new Date(`${dto.nextDueDate}T00:00:00.000Z`),
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
        ...(dto.linkedBankAccountId !== undefined && { linkedBankAccountId: dto.linkedBankAccountId }),
        ...(dto.confidence !== undefined && { confidence: dto.confidence }),
      },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.recurringObligation.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Recurring obligation not found');

    return this.prisma.recurringObligation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Every occurrence due within [asOfDate, horizonEndDate], across all active obligations. */
  async upcoming(companyId: string, asOfDate: string, horizonEndDate: string) {
    const obligations = await this.prisma.recurringObligation.findMany({
      where: { companyId, deletedAt: null, active: true },
    });

    return obligations.flatMap((o) => {
      const occurrences = projectOccurrences(
        {
          nextDueDate: o.nextDueDate.toISOString().slice(0, 10),
          frequency: o.frequency,
          amount: Number(o.amount),
        },
        asOfDate,
        horizonEndDate,
      );
      return occurrences.map((occ) => ({
        obligationId: o.id,
        name: o.name,
        category: o.category,
        frequency: o.frequency,
        dueDate: occ.dueDate,
        amount: occ.amount,
      }));
    });
  }

  /**
   * Synthetic payable-like rows for the forecast/scenario engine and AI CFO context.
   * Kept separate from real AP bills (Payable table) so AP ageing screens stay clean —
   * these never persist as Payable rows, they're computed fresh per request.
   */
  async asSyntheticPayables(
    companyId: string,
    asOfDate: string,
    horizonEndDate: string,
  ): Promise<SyntheticPayableRow[]> {
    const obligations = await this.prisma.recurringObligation.findMany({
      where: { companyId, deletedAt: null, active: true },
    });

    return obligations.flatMap((o) => {
      const occurrences = projectOccurrences(
        {
          nextDueDate: o.nextDueDate.toISOString().slice(0, 10),
          frequency: o.frequency,
          amount: Number(o.amount),
        },
        asOfDate,
        horizonEndDate,
      );
      return occurrences.map((occ, index) => ({
        id: `recurring:${o.id}:${index}`,
        counterparty: o.name,
        outstandingAmount: occ.amount,
        billDate: asOfDate,
        dueDate: occ.dueDate,
        supplierPriority: priorityForCategory(o.category),
      }));
    });
  }

  /** Roll-forward view of the very next due date per obligation, for notifications. */
  async nextDueDates(companyId: string, asOfDate: string) {
    const obligations = await this.prisma.recurringObligation.findMany({
      where: { companyId, deletedAt: null, active: true },
    });
    return obligations.map((o) => ({
      obligationId: o.id,
      name: o.name,
      category: o.category,
      amount: Number(o.amount),
      dueDate: rollForwardDueDate(o.nextDueDate.toISOString().slice(0, 10), o.frequency, asOfDate),
    }));
  }
}
