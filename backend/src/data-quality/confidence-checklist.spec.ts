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
    expect(report.recommendedNextAction).toContain('good shape');
  });

  it('flags missing bank accounts with a specific fix', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, bankAccountCount: 0 });
    expect(report.weaknesses.some((w) => w.problem.includes('No bank accounts'))).toBe(true);
    const weakness = report.weaknesses.find((w) => w.problem.includes('No bank accounts'));
    expect(weakness?.fix).toContain('Connect or add');
    expect(report.score).toBeLessThan(100);
  });

  it('flags thin history separately from missing history', () => {
    const thin = buildConfidenceReport({ ...HEALTHY_SIGNALS, historyWeeks: 3 });
    expect(thin.weaknesses.some((w) => w.problem.includes('3 week'))).toBe(true);

    const none = buildConfidenceReport({ ...HEALTHY_SIGNALS, historyWeeks: 0 });
    expect(none.weaknesses.some((w) => w.problem.includes('0 week'))).toBe(true);
  });

  it('flags missing payroll/tax obligations even when other obligations exist', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, obligationCategories: ['rent', 'subscription'] });
    const weakness = report.weaknesses.find((w) => w.problem.includes('payroll'));
    expect(weakness).toBeDefined();
    expect(weakness?.businessImpact).toContain('predictable outflows');
  });

  it('does not flag payroll/tax when at least one tax-like category is present', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, obligationCategories: ['superannuation'] });
    expect(report.weaknesses.some((w) => w.problem.includes('payroll, GST'))).toBe(false);
  });

  it('flags no budget with a specific fix', () => {
    const report = buildConfidenceReport({ ...HEALTHY_SIGNALS, hasBudget: false });
    const weakness = report.weaknesses.find((w) => w.problem.includes('No budget'));
    expect(weakness?.fix).toContain('Upload a budget');
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
    expect(report.recommendedNextAction).toBe(report.weaknesses[0].fix);
  });
});
