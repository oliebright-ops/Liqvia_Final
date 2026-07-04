import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExpectedSettlementDto,
  UpdateExpectedSettlementDto,
} from '../dto/expected-settlement.dto';
import { projectOccurrences, rollForwardDueDate } from '../recurring-obligations/occurrences';

@Injectable()
export class ExpectedSettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string = DEFAULT_DEMO_COMPANY_ID) {
    return this.prisma.expectedSettlement.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { nextExpectedDate: 'asc' },
    });
  }

  async create(companyId: string = DEFAULT_DEMO_COMPANY_ID, dto: CreateExpectedSettlementDto) {
    return this.prisma.expectedSettlement.create({
      data: {
        companyId,
        source: dto.source,
        amount: dto.amount,
        frequency: dto.frequency,
        nextExpectedDate: new Date(`${dto.nextExpectedDate}T00:00:00.000Z`),
        destinationAccountId: dto.destinationAccountId ?? null,
        status: dto.status ?? 'expected',
        confidence: dto.confidence ?? null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateExpectedSettlementDto) {
    const existing = await this.prisma.expectedSettlement.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Expected settlement not found');

    return this.prisma.expectedSettlement.update({
      where: { id },
      data: {
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.nextExpectedDate !== undefined && {
          nextExpectedDate: new Date(`${dto.nextExpectedDate}T00:00:00.000Z`),
        }),
        ...(dto.destinationAccountId !== undefined && {
          destinationAccountId: dto.destinationAccountId,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.confidence !== undefined && { confidence: dto.confidence }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.expectedSettlement.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Expected settlement not found');

    return this.prisma.expectedSettlement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Every occurrence expected within [asOfDate, horizonEndDate], across all active settlements. */
  async upcoming(companyId: string, asOfDate: string, horizonEndDate: string) {
    const settlements = await this.prisma.expectedSettlement.findMany({
      where: { companyId, deletedAt: null, active: true },
    });

    return settlements.flatMap((s) => {
      const occurrences = projectOccurrences(
        {
          nextDueDate: s.nextExpectedDate.toISOString().slice(0, 10),
          frequency: s.frequency,
          amount: Number(s.amount),
        },
        asOfDate,
        horizonEndDate,
      );
      return occurrences.map((occ) => ({
        settlementId: s.id,
        source: s.source,
        frequency: s.frequency,
        expectedDate: occ.dueDate,
        amount: occ.amount,
        status: s.status,
        confidence: s.confidence,
        destinationAccountId: s.destinationAccountId,
      }));
    });
  }

  /**
   * Synthetic receivable-like rows for the forecast/scenario engine — the inflow-side
   * counterpart to RecurringObligationsService.asSyntheticPayables. Lets Cash-Driven
   * Mode companies (no AR ageing) still get modeled inflows in the cash forecast from
   * settlement rails (NDIS, merchant, Amex, etc.) instead of showing pure cash drain.
   * Never persisted as Receivable rows, so AR ageing screens stay clean.
   */
  async asSyntheticReceivables(
    companyId: string,
    asOfDate: string,
    horizonEndDate: string,
  ): Promise<Array<{ id: string; counterparty: string; outstandingAmount: number; invoiceDate: string; dueDate: string }>> {
    const settlements = await this.prisma.expectedSettlement.findMany({
      where: { companyId, deletedAt: null, active: true },
    });

    return settlements.flatMap((s) => {
      const occurrences = projectOccurrences(
        {
          nextDueDate: s.nextExpectedDate.toISOString().slice(0, 10),
          frequency: s.frequency,
          amount: Number(s.amount),
        },
        asOfDate,
        horizonEndDate,
      );
      return occurrences.map((occ, index) => ({
        id: `settlement:${s.id}:${index}`,
        counterparty: s.source,
        outstandingAmount: occ.amount,
        invoiceDate: asOfDate,
        dueDate: occ.dueDate,
      }));
    });
  }

  /** Roll-forward view of the very next expected date per settlement. */
  async nextExpectedDates(companyId: string, asOfDate: string) {
    const settlements = await this.prisma.expectedSettlement.findMany({
      where: { companyId, deletedAt: null, active: true },
    });
    return settlements.map((s) => ({
      settlementId: s.id,
      source: s.source,
      amount: Number(s.amount),
      status: s.status,
      confidence: s.confidence,
      destinationAccountId: s.destinationAccountId,
      expectedDate: rollForwardDueDate(
        s.nextExpectedDate.toISOString().slice(0, 10),
        s.frequency,
        asOfDate,
      ),
    }));
  }
}
