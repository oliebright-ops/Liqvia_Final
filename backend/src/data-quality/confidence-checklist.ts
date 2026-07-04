import { ObligationCategory } from '@prisma/client';
import { DataQualityReport } from './data-quality.service';

export type ConfidenceRating = 'high' | 'medium' | 'low';

export interface ConfidenceWeakness {
  problem: string;
  businessImpact: string;
  fix: string;
}

export interface ConfidenceReport {
  score: number;
  rating: ConfidenceRating;
  strengths: string[];
  weaknesses: ConfidenceWeakness[];
  recommendedNextAction: string;
}

const MODULE_LABEL: Record<keyof DataQualityReport['modules'], string> = {
  bankTransactions: 'Bank transactions',
  receivables: 'AR ageing',
  payables: 'AP ageing',
  budgetActuals: 'Budget / weekly actuals',
};

const TAX_LIKE_CATEGORIES: ObligationCategory[] = ['payroll', 'superannuation', 'payg_withholding', 'gst_bas'];

export interface ConfidenceSignals {
  dataQuality: DataQualityReport;
  bankAccountCount: number;
  historyWeeks: number;
  obligationCategories: ObligationCategory[];
  hasBudget: boolean;
}

/**
 * Deterministic, explainable confidence checklist — every weakness carries its own
 * corrective action, so a reduction in score is never a black-box number. Kept
 * rule-based rather than AI-generated: "explainable confidence" is better served by
 * fixed, auditable logic than an LLM narrative that could vary between calls.
 */
export function buildConfidenceReport(signals: ConfidenceSignals): ConfidenceReport {
  const strengths: string[] = [];
  const weaknesses: ConfidenceWeakness[] = [];
  let passed = 0;
  let total = 0;

  // Per-module freshness, reusing the existing data-quality scoring rather than
  // re-deriving it — this phase explains the same signal, it doesn't recompute it.
  for (const key of Object.keys(signals.dataQuality.modules) as Array<keyof DataQualityReport['modules']>) {
    total += 1;
    const module = signals.dataQuality.modules[key];
    const label = MODULE_LABEL[key];
    if (module.status === 'fresh') {
      passed += 1;
      strengths.push(`${label} is up to date.`);
    } else if (module.status === 'stale') {
      weaknesses.push({
        problem: `${label} hasn't been updated in ${module.daysSinceUpdate} day(s).`,
        businessImpact: 'Forecast and AI CFO answers may be based on outdated figures.',
        fix: `Upload fresh ${label.toLowerCase()} data.`,
      });
    } else {
      weaknesses.push({
        problem: `${label} has no data at all.`,
        businessImpact: 'Anything relying on this module is a rough estimate, not a real figure.',
        fix: `Upload ${label.toLowerCase()} to enable this.`,
      });
    }
  }

  total += 1;
  if (signals.bankAccountCount > 0) {
    passed += 1;
    strengths.push(`${signals.bankAccountCount} bank account(s) connected.`);
  } else {
    weaknesses.push({
      problem: 'No bank accounts connected.',
      businessImpact: 'Cash position is based on manual entry only, not real transactions.',
      fix: 'Connect or add at least one bank account.',
    });
  }

  total += 1;
  if (signals.historyWeeks >= 8) {
    passed += 1;
    strengths.push(`${signals.historyWeeks} weeks of transaction history available.`);
  } else {
    weaknesses.push({
      problem: `Only ${signals.historyWeeks} week(s) of transaction history.`,
      businessImpact: 'Forecasts and burn-rate estimates are less reliable with limited history.',
      fix: 'Upload more historical bank transactions or weekly actuals.',
    });
  }

  total += 1;
  const hasTaxLikeObligation = signals.obligationCategories.some((c) => TAX_LIKE_CATEGORIES.includes(c));
  if (hasTaxLikeObligation) {
    passed += 1;
    strengths.push('Payroll and tax obligations are modeled as recurring commitments.');
  } else {
    weaknesses.push({
      problem: 'No payroll, GST, PAYG, or super obligations configured.',
      businessImpact: 'The forecast can miss large, predictable outflows before they hit the bank feed.',
      fix: 'Add recurring obligations for payroll and tax in Settings → Recurring Obligations.',
    });
  }

  total += 1;
  if (signals.hasBudget) {
    passed += 1;
    strengths.push('A budget is in place to compare actuals against.');
  } else {
    weaknesses.push({
      problem: 'No budget uploaded.',
      businessImpact: 'There is nothing to check whether actuals are tracking to plan.',
      fix: 'Upload a budget to enable budget-vs-actual comparison.',
    });
  }

  const score = Math.round((passed / total) * 100);
  const rating: ConfidenceRating = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
  const recommendedNextAction =
    weaknesses.length > 0 ? weaknesses[0].fix : 'Keep uploads current — this workspace is in good shape.';

  return { score, rating, strengths, weaknesses, recommendedNextAction };
}
