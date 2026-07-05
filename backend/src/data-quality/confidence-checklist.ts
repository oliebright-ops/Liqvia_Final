import { ObligationCategory } from '@prisma/client';
import { DataQualityReport } from './data-quality.service';

export type ConfidenceRating = 'high' | 'medium' | 'low';

/**
 * Structured message instead of a finished sentence — the frontend resolves `key`
 * against modules.confidenceLayer.messages.* in the active locale and interpolates
 * `params`, so this layer stays translatable instead of baking English text into the API.
 */
export interface ConfidenceMessage {
  key: string;
  params?: Record<string, string>;
}

export interface ConfidenceWeakness {
  problem: ConfidenceMessage;
  businessImpact: ConfidenceMessage;
  fix: ConfidenceMessage;
}

export interface ConfidenceReport {
  score: number;
  rating: ConfidenceRating;
  strengths: ConfidenceMessage[];
  weaknesses: ConfidenceWeakness[];
  recommendedNextAction: ConfidenceMessage;
}

// Matches the modules.dataQuality.module* locale keys so both cards use one label per module.
const MODULE_KEY: Record<keyof DataQualityReport['modules'], string> = {
  bankTransactions: 'bankTransactions',
  receivables: 'receivables',
  payables: 'payables',
  budgetActuals: 'budgetActuals',
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
  const strengths: ConfidenceMessage[] = [];
  const weaknesses: ConfidenceWeakness[] = [];
  let passed = 0;
  let total = 0;

  // Per-module freshness, reusing the existing data-quality scoring rather than
  // re-deriving it — this phase explains the same signal, it doesn't recompute it.
  for (const key of Object.keys(signals.dataQuality.modules) as Array<keyof DataQualityReport['modules']>) {
    total += 1;
    const module = signals.dataQuality.modules[key];
    const moduleKey = MODULE_KEY[key];
    if (module.status === 'fresh') {
      passed += 1;
      strengths.push({ key: 'moduleFresh', params: { module: moduleKey } });
    } else if (module.status === 'stale') {
      weaknesses.push({
        problem: { key: 'moduleStale', params: { module: moduleKey, days: String(module.daysSinceUpdate) } },
        businessImpact: { key: 'moduleStaleImpact' },
        fix: { key: 'moduleStaleFix', params: { module: moduleKey } },
      });
    } else {
      weaknesses.push({
        problem: { key: 'moduleMissing', params: { module: moduleKey } },
        businessImpact: { key: 'moduleMissingImpact' },
        fix: { key: 'moduleMissingFix', params: { module: moduleKey } },
      });
    }
  }

  total += 1;
  if (signals.bankAccountCount > 0) {
    passed += 1;
    strengths.push({ key: 'bankAccountsConnected', params: { count: String(signals.bankAccountCount) } });
  } else {
    weaknesses.push({
      problem: { key: 'noBankAccounts' },
      businessImpact: { key: 'noBankAccountsImpact' },
      fix: { key: 'noBankAccountsFix' },
    });
  }

  total += 1;
  if (signals.historyWeeks >= 8) {
    passed += 1;
    strengths.push({ key: 'historyWeeksAvailable', params: { weeks: String(signals.historyWeeks) } });
  } else {
    weaknesses.push({
      problem: { key: 'historyWeeksLow', params: { weeks: String(signals.historyWeeks) } },
      businessImpact: { key: 'historyWeeksLowImpact' },
      fix: { key: 'historyWeeksLowFix' },
    });
  }

  total += 1;
  const hasTaxLikeObligation = signals.obligationCategories.some((c) => TAX_LIKE_CATEGORIES.includes(c));
  if (hasTaxLikeObligation) {
    passed += 1;
    strengths.push({ key: 'taxObligationsModeled' });
  } else {
    weaknesses.push({
      problem: { key: 'noTaxObligations' },
      businessImpact: { key: 'noTaxObligationsImpact' },
      fix: { key: 'noTaxObligationsFix' },
    });
  }

  total += 1;
  if (signals.hasBudget) {
    passed += 1;
    strengths.push({ key: 'budgetInPlace' });
  } else {
    weaknesses.push({
      problem: { key: 'noBudget' },
      businessImpact: { key: 'noBudgetImpact' },
      fix: { key: 'noBudgetFix' },
    });
  }

  const score = Math.round((passed / total) * 100);
  const rating: ConfidenceRating = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
  const recommendedNextAction: ConfidenceMessage =
    weaknesses.length > 0 ? weaknesses[0].fix : { key: 'allGood' };

  return { score, rating, strengths, weaknesses, recommendedNextAction };
}
