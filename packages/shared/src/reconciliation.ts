/**
 * Lightweight bank-to-ledger reconciliation matching.
 *
 * This is a heuristic, amount/date-proximity matcher — not a full accounting-grade
 * reconciliation engine. It exists to surface, directly in the product, which bank
 * movements plausibly correspond to an open receivable/payable, which look like a
 * partial payment against a larger invoice/bill, and which have no plausible match
 * at all (e.g. an unexplained deposit). Each AR/AP record can be consumed by at
 * most one movement, so it can't double-count one invoice against two deposits.
 *
 * Explicitly out of scope (documented, not silently assumed): multi-invoice
 * batch payments, foreign-exchange rounding, and partial payments split across
 * more than one bank movement. Treat results as a starting point for review, not
 * a certified match.
 */

export type ReconciliationStatus = 'matched' | 'partial' | 'unmatched';

export interface ReconciliationMovementInput {
  id: string;
  movementDate: string;
  amount: number;
  isInflow: boolean;
  description?: string | null;
}

export interface ReconciliationRecordInput {
  id: string;
  counterparty: string;
  amount: number;
  /** Invoice due date (receivable) or bill due date (payable). */
  dueDate: string;
}

export interface ReconciliationResult {
  movementId: string;
  status: ReconciliationStatus;
  matchedRecordId?: string;
  matchedCounterparty?: string;
  /** Positive = movement is smaller than the matched record (a partial payment). */
  varianceAmount?: number;
}

export interface ReconciliationSummary {
  matched: number;
  partial: number;
  unmatched: number;
  unmatchedInflowTotal: number;
  unmatchedOutflowTotal: number;
}

const AMOUNT_TOLERANCE_RATIO = 0.01; // 1%
const AMOUNT_TOLERANCE_FLOOR = 1; // currency units, for small amounts
const DATE_WINDOW_DAYS = 21;

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(AMOUNT_TOLERANCE_FLOOR, b * AMOUNT_TOLERANCE_RATIO);
}

function withinDateWindow(movementDate: string, dueDate: string, days: number): boolean {
  const move = new Date(`${movementDate.slice(0, 10)}T00:00:00.000Z`).getTime();
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.abs(move - due) <= days * 24 * 60 * 60 * 1000;
}

function isBalanceAnchorDescription(description?: string | null): boolean {
  return (description ?? '').trim().toLowerCase() === 'balance upload';
}

/**
 * Matches bank movements against open receivables (for inflows) or payables (for
 * outflows). Movements are processed oldest-first so earlier transactions get first
 * claim on a matching record when more than one movement could plausibly match it.
 */
export function matchBankMovements(
  movements: ReconciliationMovementInput[],
  receivables: ReconciliationRecordInput[],
  payables: ReconciliationRecordInput[],
): { results: ReconciliationResult[]; summary: ReconciliationSummary } {
  const consumedReceivables = new Set<string>();
  const consumedPayables = new Set<string>();

  const sortedMovements = [...movements]
    .filter((m) => !isBalanceAnchorDescription(m.description))
    .sort((a, b) => a.movementDate.localeCompare(b.movementDate));

  const results: ReconciliationResult[] = sortedMovements.map((movement) => {
    const pool = movement.isInflow ? receivables : payables;
    const consumed = movement.isInflow ? consumedReceivables : consumedPayables;

    const candidates = pool.filter(
      (r) => !consumed.has(r.id) && withinDateWindow(movement.movementDate, r.dueDate, DATE_WINDOW_DAYS),
    );

    const exact = candidates.find((r) => amountsMatch(movement.amount, r.amount));
    if (exact) {
      consumed.add(exact.id);
      return {
        movementId: movement.id,
        status: 'matched',
        matchedRecordId: exact.id,
        matchedCounterparty: exact.counterparty,
      };
    }

    // Partial payment: movement is smaller than an open record for the same
    // rough period — pick the closest larger amount so it isn't matched twice.
    const partial = candidates
      .filter((r) => r.amount > movement.amount)
      .sort((a, b) => a.amount - b.amount)[0];
    if (partial) {
      consumed.add(partial.id);
      return {
        movementId: movement.id,
        status: 'partial',
        matchedRecordId: partial.id,
        matchedCounterparty: partial.counterparty,
        varianceAmount: Math.round((partial.amount - movement.amount) * 100) / 100,
      };
    }

    return { movementId: movement.id, status: 'unmatched' };
  });

  const summary = results.reduce<ReconciliationSummary>(
    (acc, r, i) => {
      const movement = sortedMovements[i];
      if (r.status === 'matched') acc.matched += 1;
      else if (r.status === 'partial') acc.partial += 1;
      else {
        acc.unmatched += 1;
        if (movement.isInflow) acc.unmatchedInflowTotal += movement.amount;
        else acc.unmatchedOutflowTotal += movement.amount;
      }
      return acc;
    },
    { matched: 0, partial: 0, unmatched: 0, unmatchedInflowTotal: 0, unmatchedOutflowTotal: 0 },
  );

  summary.unmatchedInflowTotal = Math.round(summary.unmatchedInflowTotal * 100) / 100;
  summary.unmatchedOutflowTotal = Math.round(summary.unmatchedOutflowTotal * 100) / 100;

  return { results, summary };
}
