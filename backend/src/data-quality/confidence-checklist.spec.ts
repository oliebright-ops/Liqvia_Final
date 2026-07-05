import { buildConfidenceReport, ConfidenceSignals } from './confidence-checklist';
import { DataQualityReport } from './data-quality.service';

function freshDataQuality(): DataQualityReport {
  const fresh = { status: 'fresh' as const, lastUpdated: '2026-07-04', daysSinceUpdate: 0 };
  return {
    score: 100,
    modules: { bankTransactions: fresh, receivables: fresh, payables: fresh, budgetActuals: fresh },
    warnings: [],
  };
}

function missingDataQuality(): DataQualityReport {
  const missing = { status: 'missing' as const, lastUpdated: null, daysSinceUpdate: null };
  return {
    score: 0,
    modules: { bankTransactions: missing, receivables: missing, payables: missing, budgetActuals: missing },
    warnings: ['everything missing'],
  };
}

const HEALTHY_SIGNALS: ConfidenceSignals = {
  dataQuality: freshDataQuality(),
  bankAccountCount: 2,
  historyWeeks: 12,
  obligationCategories: ['payroll', 'gst_bas'],
  hasBudget: true,
};

describe('buildConfidenceReport', () => {
  it('scores 100 and rates high when every signal passes', () => {
    const report = buildConfidenceReport(HEALTHY_SIGNALS);
    expect(report.score).toBe(100);
    expect(report.rating).toBe('high');
    expect(report.weaknesses).toHaveLength(0);
    expect(report.recommendedNextAction).toEqual({ key: 'allGood' });
  });

  it('flags missing bank accounts with a specific fix', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, bankAccountCount: 0 });
    const weakness = report.weaknesses.find((w) => w.problem.key === 'noBankAccounts');
    expect(weakness).toBeDefined();
    expect(weakness?.fix.key).toBe('noBankAccountsFix');
    expect(report.score).toBeLessThan(100);
  });

  it('flags thin history separately from missing history', () => {
    const thin = buildConfidenceReport({ ...HEALTHY_SIGNALS, historyWeeks: 3 });
    const thinWeakness = thin.weaknesses.find((w) => w.problem.key === 'historyWeeksLow');
    expect(thinWeakness?.problem.params).toEqual({ weeks: '3' });

    const none = buildConfidenceReport({ ...HEALTHY_SIGNALS, historyWeeks: 0 });
    const noneWeakness = none.weaknesses.find((w) => w.problem.key === 'historyWeeksLow');
    expect(noneWeakness?.problem.params).toEqual({ weeks: '0' });
  });

  it('flags missing payroll/tax obligations even when other obligations exist', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, obligationCategories: ['rent', 'subscription'] });
    const weakness = report.weaknesses.find((w) => w.problem.key === 'noTaxObligations');
    expect(weakness).toBeDefined();
    expect(weakness?.businessImpact.key).toBe('noTaxObligationsImpact');
  });

  it('does not flag payroll/tax when at least one tax-like category is present', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, obligationCategories: ['superannuation'] });
    expect(report.weaknesses.some((w) => w.problem.key === 'noTaxObligations')).toBe(false);
  });

  it('flags no budget with a specific fix', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, hasBudget: false });
    const weakness = report.weaknesses.find((w) => w.problem.key === 'noBudget');
    expect(weakness?.fix.key).toBe('noBudgetFix');
  });

  it('rates low when almost every signal fails', () => {
    const report = buildConfidenceReport({
      dataQuality: missingDataQuality(),
      bankAccountCount: 0,
      historyWeeks: 0,
      obligationCategories: [],
      hasBudget: false,
    });
    expect(report.rating).toBe('low');
    expect(report.score).toBeLessThan(50);
    expect(report.weaknesses.length).toBeGreaterThanOrEqual(6);
  });

  it('recommends the first weakness fix as the next action when anything is weak', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, bankAccountCount: 0 });
    expect(report.recommendedNextAction).toEqual(report.weaknesses[0].fix);
  });
});
