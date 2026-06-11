/** Expense-side budget categories (everything except revenue). */
export function isExpenseCategory(category: string): boolean {
  return category !== 'revenue';
}

/**
 * Budget variance by category.
 * Revenue: actual − budget (beat target = positive).
 * Expenses: under budget = positive; supports signed negative actuals from uploads.
 */
export function computeBudgetVarianceAmount(
  category: string,
  budgetAmount: number,
  actualAmount: number,
): number {
  if (!isExpenseCategory(category)) {
    return round2(actualAmount - budgetAmount);
  }
  if (budgetAmount <= 0 && actualAmount <= 0) {
    return round2(actualAmount - budgetAmount);
  }
  return round2(budgetAmount - actualAmount);
}

export function computeBudgetVariancePercent(
  category: string,
  budgetAmount: number,
  varianceAmount: number,
): number | null {
  const base = isExpenseCategory(category) ? Math.abs(budgetAmount) : budgetAmount;
  if (base === 0) return null;
  return round1((varianceAmount / base) * 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
