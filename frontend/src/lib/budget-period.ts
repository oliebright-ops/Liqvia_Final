/** Calendar month key `YYYY-MM` for a budget period (weekly or monthly). */
export function budgetPeriodMonth(period: string): string | null {
  const monthly = period.match(/^(\d{4})-(\d{2})$/);
  if (monthly && !period.includes('W') && !period.includes('Q')) {
    return `${monthly[1]}-${monthly[2]}`;
  }

  const weekly = period.match(/^(\d{4})-W(\d{1,2})$/i);
  if (!weekly) return null;

  const year = Number(weekly[1]);
  const week = Number(weekly[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  const y = weekStart.getUTCFullYear();
  const m = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function budgetPeriodYear(period: string): string | null {
  const month = budgetPeriodMonth(period);
  if (month) return month.slice(0, 4);
  const yearOnly = period.match(/^(\d{4})/);
  return yearOnly ? yearOnly[1] : null;
}

export function budgetPeriodQuarter(period: string): string | null {
  const month = budgetPeriodMonth(period);
  if (!month) return null;
  const [year, mo] = month.split('-');
  const quarter = Math.ceil(Number(mo) / 3);
  return `${year}-Q${quarter}`;
}

export function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))].sort();
}
