import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';

export type ModuleStatus = 'missing' | 'stale' | 'fresh';

export interface ModuleQuality {
  status: ModuleStatus;
  lastUpdated: string | null;
  daysSinceUpdate: number | null;
}

export interface DataQualityReport {
  score: number;
  modules: {
    bankTransactions: ModuleQuality;
    receivables: ModuleQuality;
    payables: ModuleQuality;
    budgetActuals: ModuleQuality;
  };
  warnings: string[];
}

/** Days after which each module's most recent data point is considered stale rather than fresh. */
const STALE_AFTER_DAYS = {
  bankTransactions: 14,
  receivables: 30,
  payables: 30,
  budgetActuals: 45,
} as const;

const MODULE_LABELS: Record<keyof DataQualityReport['modules'], string> = {
  bankTransactions: 'Bank transactions',
  receivables: 'AR ageing',
  payables: 'AP ageing',
  budgetActuals: 'Budget / weekly actuals',
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function toModuleQuality(latest: Date | null, asOf: Date, staleAfterDays: number): ModuleQuality {
  if (!latest) return { status: 'missing', lastUpdated: null, daysSinceUpdate: null };
  const days = Math.max(0, daysBetween(latest, asOf));
  return {
    status: days > staleAfterDays ? 'stale' : 'fresh',
    lastUpdated: latest.toISOString().slice(0, 10),
    daysSinceUpdate: days,
  };
}

function scoreForStatus(status: ModuleStatus): number {
  if (status === 'fresh') return 100;
  if (status === 'stale') return 50;
  return 0;
}

@Injectable()
export class DataQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(companyId: string = DEFAULT_DEMO_COMPANY_ID): Promise<DataQualityReport> {
    const asOf = new Date();

    const [latestMovement, latestReceivable, latestPayable, latestActual] = await Promise.all([
      this.prisma.cashMovement.findFirst({
        where: { companyId },
        orderBy: { movementDate: 'desc' },
        select: { movementDate: true },
      }),
      this.prisma.receivable.findFirst({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.payable.findFirst({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.weeklyActual.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const modules: DataQualityReport['modules'] = {
      bankTransactions: toModuleQuality(
        latestMovement?.movementDate ?? null,
        asOf,
        STALE_AFTER_DAYS.bankTransactions,
      ),
      receivables: toModuleQuality(
        latestReceivable?.createdAt ?? null,
        asOf,
        STALE_AFTER_DAYS.receivables,
      ),
      payables: toModuleQuality(
        latestPayable?.createdAt ?? null,
        asOf,
        STALE_AFTER_DAYS.payables,
      ),
      budgetActuals: toModuleQuality(
        latestActual?.createdAt ?? null,
        asOf,
        STALE_AFTER_DAYS.budgetActuals,
      ),
    };

    const statuses = Object.values(modules).map((m) => m.status);
    const score = Math.round(
      statuses.reduce((sum, status) => sum + scoreForStatus(status), 0) / statuses.length,
    );

    const warnings = (Object.keys(modules) as Array<keyof typeof modules>)
      .filter((key) => modules[key].status !== 'fresh')
      .map((key) => {
        const m = modules[key];
        const label = MODULE_LABELS[key];
        if (m.status === 'missing') {
          return `${label}: no data uploaded yet — figures relying on this module are estimates.`;
        }
        return `${label}: last updated ${m.daysSinceUpdate} day(s) ago — consider a fresh upload.`;
      });

    return { score, modules, warnings };
  }
}
