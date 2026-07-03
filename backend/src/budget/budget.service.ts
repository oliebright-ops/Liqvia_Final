import { Injectable } from '@nestjs/common';
import { AccountType, BudgetCategory } from '@prisma/client';
import {
  BudgetVarianceResult,
  DEFAULT_DEMO_COMPANY_ID,
  computeBudgetVarianceAmount,
  computeBudgetVariancePercent,
  computeRollingVariance,
  getPastWeekPeriods,
  type RollingBudgetCategory,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TreasuryKpiService } from '../treasury/treasury-kpi.service';

/** Map a chart-of-account type to the budget category it contributes to. */
const ACCOUNT_TYPE_TO_CATEGORY: Partial<Record<AccountType, BudgetCategory>> = {
  revenue: BudgetCategory.revenue,
  expense: BudgetCategory.expenses,
};

export interface BudgetVsActualSummary {
  companyId: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  lines: BudgetVarianceResult[];
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpis: TreasuryKpiService,
  ) {}

  async getBudgetVsActual(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
  ): Promise<BudgetVsActualSummary> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const budgetLines = await this.prisma.budgetLine.findMany({
      where: { budget: { companyId } },
      include: { chartOfAccount: true },
    });

    const weeklyActuals = await this.prisma.weeklyActual.findMany({
      where: { companyId },
    });

    let lines: BudgetVarianceResult[];

    if (weeklyActuals.length > 0) {
      const pastWindow = new Set(getPastWeekPeriods(asOfDate));
      const budgetRows = budgetLines
        .filter(
          (l) =>
            pastWindow.has(l.period) && (l.budgetType === 'prior' || l.budgetType === 'operating'),
        )
        .map((l) => ({
          period: l.period,
          category: l.category as RollingBudgetCategory,
          amount: Number(l.budgetAmount),
        }));
      const actualRows = weeklyActuals.map((a) => ({
        period: a.period,
        category: a.category as RollingBudgetCategory,
        amount: Number(a.actualAmount),
      }));
      lines = computeRollingVariance(budgetRows, actualRows, asOfDate).map((l) => ({
        period: l.period,
        category: l.category,
        budgetAmount: l.budgetAmount,
        actualAmount: l.actualAmount,
        varianceAmount: l.varianceAmount,
        variancePercent: l.variancePercent,
      }));

      const rollingForward = this.dedupeRollingForward(
        budgetLines.filter(
          (l) =>
            (l.budgetType === 'rolling' || l.budgetType === 'rolling_auto') &&
            !pastWindow.has(l.period),
        ),
      );
      for (const line of rollingForward) {
        const budgetAmount = Number(line.budgetAmount);
        const varianceAmount = computeBudgetVarianceAmount(line.category, budgetAmount, 0);
        lines.push({
          period: line.period,
          category: line.category,
          budgetAmount,
          actualAmount: 0,
          varianceAmount,
          variancePercent: computeBudgetVariancePercent(
            line.category,
            budgetAmount,
            varianceAmount,
          ),
        });
      }
    } else {
      const actualsByCategory = await this.computeActualsByCategory(companyId);
      const actualsByAccount = await this.computeActualsByAccount(companyId);

      const inputs = budgetLines.map((line) => {
        const accountCode = line.chartOfAccount?.code;
        const actualAmount =
          accountCode && actualsByAccount.has(accountCode)
            ? actualsByAccount.get(accountCode)!
            : (actualsByCategory.get(line.category) ?? 0);
        return {
          period: line.period,
          category: line.category,
          budgetAmount: Number(line.budgetAmount),
          actualAmount,
        };
      });

      lines = this.kpis.calculateBudgetVariances(inputs);
    }
    const totalBudget = lines.reduce((s, l) => s + l.budgetAmount, 0);
    const totalActual = lines.reduce((s, l) => s + l.actualAmount, 0);
    const totalVariance = lines.reduce((s, l) => s + l.varianceAmount, 0);

    return {
      companyId,
      totalBudget: round2(totalBudget),
      totalActual: round2(totalActual),
      totalVariance: round2(totalVariance),
      lines,
    };
  }

  /**
   * When a company has an explicit rolling_budget.csv upload (budgetType 'rolling') for a
   * given period + category + account, the system also auto-generates a 'rolling_auto'
   * fallback line (see syncRollingBudgetIfNeeded in upload-import.service.ts) that is never
   * cleaned up once a real upload arrives. Left unfiltered, both lines flow into the
   * forward-looking budget view and double up. Prefer the explicit 'rolling' line and drop
   * the auto-generated fallback wherever both exist for the same (period, category, account).
   */
  private dedupeRollingForward<
    T extends {
      period: string;
      category: BudgetCategory;
      budgetType: string;
      chartOfAccount?: { code: string } | null;
    },
  >(lines: T[]): T[] {
    const byKey = new Map<string, T>();
    for (const line of lines) {
      const key = `${line.period}::${line.category}::${line.chartOfAccount?.code ?? ''}`;
      const existing = byKey.get(key);
      if (!existing || (existing.budgetType === 'rolling_auto' && line.budgetType === 'rolling')) {
        byKey.set(key, line);
      }
    }
    return Array.from(byKey.values());
  }

  /** Actual amount per account code = sum(debit - credit) across journal lines. */
  private async computeActualsByAccount(companyId: string): Promise<Map<string, number>> {
    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntry: { companyId } },
      include: { chartOfAccount: true },
    });

    const map = new Map<string, number>();
    for (const line of lines) {
      const code = line.chartOfAccount.code;
      const signed = signedActual(
        line.chartOfAccount.accountType,
        Number(line.debit),
        Number(line.credit),
      );
      map.set(code, (map.get(code) ?? 0) + signed);
    }
    return map;
  }

  private async computeActualsByCategory(companyId: string): Promise<Map<BudgetCategory, number>> {
    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntry: { companyId } },
      include: { chartOfAccount: true },
    });

    const map = new Map<BudgetCategory, number>();
    for (const line of lines) {
      const category = ACCOUNT_TYPE_TO_CATEGORY[line.chartOfAccount.accountType];
      if (!category) continue;
      const signed = signedActual(
        line.chartOfAccount.accountType,
        Number(line.debit),
        Number(line.credit),
      );
      map.set(category, (map.get(category) ?? 0) + signed);
    }
    return map;
  }
}

/** Revenue is credit-positive; expenses/assets are debit-positive. */
function signedActual(type: AccountType, debit: number, credit: number): number {
  if (
    type === AccountType.revenue ||
    type === AccountType.liability ||
    type === AccountType.equity
  ) {
    return credit - debit;
  }
  return debit - credit;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
