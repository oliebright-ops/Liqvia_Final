import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function agingBucket(daysPastDue: number): string {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  return '90+';
}

function daysBetween(asOf: string, date: string): number {
  const a = new Date(asOf).getTime();
  const b = new Date(date).getTime();
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getLedger(companyId: string) {
    const asOfDate = new Date().toISOString().slice(0, 10);

    const [receivables, payables, company] = await Promise.all([
      this.prisma.receivable.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.payable.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.company.findUnique({ where: { id: companyId } }),
    ]);

    const arEntries = receivables.map((r) => {
      const daysPastDue = daysBetween(asOfDate, r.dueDate.toISOString().slice(0, 10));
      return {
        id: r.id,
        type: 'receivable' as const,
        counterparty: r.customerName,
        documentNumber: r.invoiceNumber,
        documentDate: r.invoiceDate.toISOString().slice(0, 10),
        dueDate: r.dueDate.toISOString().slice(0, 10),
        outstandingAmount: Number(r.outstandingAmount),
        currency: r.currency,
        daysPastDue,
        agingBucket: agingBucket(daysPastDue),
        status: daysPastDue > 0 ? 'overdue' : 'open',
      };
    });

    const apEntries = payables.map((p) => {
      const daysPastDue = daysBetween(asOfDate, p.dueDate.toISOString().slice(0, 10));
      return {
        id: p.id,
        type: 'payable' as const,
        counterparty: p.supplierName,
        documentNumber: p.billNumber,
        documentDate: p.billDate.toISOString().slice(0, 10),
        dueDate: p.dueDate.toISOString().slice(0, 10),
        outstandingAmount: Number(p.outstandingAmount),
        currency: p.currency,
        supplierPriority: p.supplierPriority,
        daysPastDue,
        agingBucket: agingBucket(daysPastDue),
        status: daysPastDue > 0 ? 'overdue' : 'open',
      };
    });

    const summarizeAging = (entries: { agingBucket: string; outstandingAmount: number }[]) => {
      const buckets = ['current', '1-30', '31-60', '61-90', '90+'] as const;
      return buckets.map((bucket) => ({
        bucket,
        amount: entries
          .filter((e) => e.agingBucket === bucket)
          .reduce((s, e) => s + e.outstandingAmount, 0),
        count: entries.filter((e) => e.agingBucket === bucket).length,
      }));
    };

    return {
      companyId,
      currency: company?.currency ?? 'USD',
      asOfDate,
      receivables: arEntries,
      payables: apEntries,
      arAging: summarizeAging(arEntries),
      apAging: summarizeAging(apEntries),
      totals: {
        arOutstanding: arEntries.reduce((s, e) => s + e.outstandingAmount, 0),
        apOutstanding: apEntries.reduce((s, e) => s + e.outstandingAmount, 0),
        arOverdue: arEntries
          .filter((e) => e.status === 'overdue')
          .reduce((s, e) => s + e.outstandingAmount, 0),
        apOverdue: apEntries
          .filter((e) => e.status === 'overdue')
          .reduce((s, e) => s + e.outstandingAmount, 0),
      },
    };
  }
}
