export type PeriodGranularity = 'monthly' | 'weekly';

const MONTH_RE = /^\d{4}-\d{2}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;

/** Resolve the active reporting period for dashboards and analysis. */
export function resolveReportingPeriod(
  asOfDate: string,
  reportingPeriod?: string | null,
  granularity: PeriodGranularity = 'monthly',
): string {
  if (reportingPeriod?.trim()) {
    const p = reportingPeriod.trim();
    if (granularity === 'weekly' && WEEK_RE.test(p)) return p;
    if (granularity === 'monthly' && MONTH_RE.test(p)) return p;
    if (MONTH_RE.test(p)) return p;
    if (WEEK_RE.test(p)) return p;
  }
  if (granularity === 'weekly') {
    return toIsoWeek(asOfDate);
  }
  return asOfDate.slice(0, 7);
}

export function toIsoWeek(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function validateReportingPeriod(
  value: string,
  granularity: PeriodGranularity,
): string | null {
  const v = value.trim();
  if (granularity === 'weekly' && !WEEK_RE.test(v)) {
    return 'Use format YYYY-W## (e.g. 2026-W04)';
  }
  if (granularity === 'monthly' && !MONTH_RE.test(v)) {
    return 'Use format YYYY-MM (e.g. 2026-01)';
  }
  return null;
}
