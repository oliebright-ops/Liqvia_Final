import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringObligationsService } from '../recurring-obligations/recurring-obligations.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { FreeCashService } from '../free-cash/free-cash.service';
import { DataQualityService } from '../data-quality/data-quality.service';
import { AiService } from '../ai/ai.service';
import {
  BusinessPulseItem,
  buildCashBufferItem,
  buildExpectedReceiptItem,
  buildForecastShortfallItem,
  buildObligationItem,
  buildOverduePayableItem,
  buildOverdueReceivableItem,
  buildStaleBankDataItem,
  rankPulseItems,
} from './pulse-ranking';

export interface BusinessPulseReport {
  asOfDate: string;
  items: BusinessPulseItem[];
  briefing: string;
  briefingModel: string;
  briefingSource: 'openai' | 'rule_based';
}

const OBLIGATION_HORIZON_DAYS = 14;
const EXPECTED_RECEIPT_HORIZON_DAYS = 14;

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BusinessPulseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurringObligations: RecurringObligationsService,
    private readonly treasuryEngine: TreasuryEngineService,
    private readonly freeCash: FreeCashService,
    private readonly dataQuality: DataQualityService,
    private readonly aiService: AiService,
  ) {}

  async getPulse(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    locale?: string,
  ): Promise<BusinessPulseReport> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const horizonEndDate = addDaysIso(asOfDate, OBLIGATION_HORIZON_DAYS);

    const [
      company,
      obligations,
      payablesRaw,
      receivablesRaw,
      engineResult,
      freeCashReport,
      dataQualityReport,
      briefing,
    ] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      this.recurringObligations.upcoming(companyId, asOfDate, horizonEndDate),
      this.prisma.payable.findMany({ where: { companyId, deletedAt: null } }),
      this.prisma.receivable.findMany({ where: { companyId, deletedAt: null } }),
      this.treasuryEngine.generateForCompany(companyId, false),
      this.freeCash.getReport(companyId, 13),
      this.dataQuality.getReport(companyId),
      this.aiService.generateBusinessPulseBriefing(companyId, locale),
    ]);

    const currency = company.currency;
    const candidates: BusinessPulseItem[] = [];

    for (const o of obligations) {
      candidates.push(buildObligationItem(o, asOfDate, currency));
    }

    for (const p of payablesRaw) {
      const dueDate = p.dueDate.toISOString().slice(0, 10);
      if (dueDate >= asOfDate) continue;
      const daysOverdue = daysBetweenPlain(dueDate, asOfDate);
      candidates.push(
        buildOverduePayableItem(
          {
            id: p.id,
            counterparty: p.supplierName,
            outstandingAmount: Number(p.outstandingAmount),
            dueDate,
            daysOverdue,
            supplierPriority: p.supplierPriority,
          },
          currency,
        ),
      );
    }

    let bestExpectedReceipt: BusinessPulseItem | null = null;
    for (const r of receivablesRaw) {
      const dueDate = r.dueDate.toISOString().slice(0, 10);
      const outstandingAmount = Number(r.outstandingAmount);
      if (dueDate < asOfDate) {
        const daysOverdue = daysBetweenPlain(dueDate, asOfDate);
        candidates.push(
          buildOverdueReceivableItem(
            { id: r.id, counterparty: r.customerName, outstandingAmount, dueDate, daysOverdue },
            currency,
          ),
        );
      } else if (dueDate <= addDaysIso(asOfDate, EXPECTED_RECEIPT_HORIZON_DAYS)) {
        const item = buildExpectedReceiptItem(
          { id: r.id, counterparty: r.customerName, outstandingAmount, dueDate },
          asOfDate,
          currency,
        );
        if (!bestExpectedReceipt || item.score > bestExpectedReceipt.score) {
          bestExpectedReceipt = item;
        }
      }
    }
    if (bestExpectedReceipt) candidates.push(bestExpectedReceipt);

    const cashBufferItem = buildCashBufferItem(
      freeCashReport.freeAvailableCash,
      engineResult.runwayWeeks,
      currency,
    );
    if (cashBufferItem) candidates.push(cashBufferItem);

    const forecastShortfallItem = buildForecastShortfallItem(engineResult.forecastLines, currency);
    if (forecastShortfallItem) candidates.push(forecastShortfallItem);

    const staleBankDataItem = buildStaleBankDataItem(
      dataQualityReport.modules.bankTransactions.daysSinceUpdate,
      currency,
    );
    if (staleBankDataItem) candidates.push(staleBankDataItem);

    return {
      asOfDate,
      items: rankPulseItems(candidates, 5),
      briefing: briefing.text,
      briefingModel: briefing.model,
      briefingSource: briefing.source,
    };
  }
}

function daysBetweenPlain(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = new Date(`${toIso}T00:00:00.000Z`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
