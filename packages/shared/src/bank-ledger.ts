import { categorizeTransaction } from './treasury-rules';

export const BALANCE_ANCHOR_DESCRIPTIONS = ['Balance upload', 'Opening cash balance'] as const;

export interface CashMovementLedgerInput {
  id: string;
  bankAccountId?: string;
  movementDate: string;
  amount: number;
  isInflow: boolean;
  description?: string | null;
}

export interface AccountLedgerTransaction {
  id: string;
  transactionDate: string;
  description: string;
  category: string;
  amount: number;
  direction: 'IN' | 'OUT';
  runningBalance: number;
}

export interface AccountLedgerResult {
  openingBalance: number;
  openingDate: string | null;
  closingBalance: number;
  transactions: AccountLedgerTransaction[];
}

export function isBalanceAnchor(description: string | null | undefined): boolean {
  return (BALANCE_ANCHOR_DESCRIPTIONS as readonly string[]).includes(description ?? '');
}

function sortMovements(movements: CashMovementLedgerInput[]): CashMovementLedgerInput[] {
  return [...movements].sort((a, b) => {
    const dateCmp = a.movementDate.localeCompare(b.movementDate);
    if (dateCmp !== 0) return dateCmp;
    const aAnchor = isBalanceAnchor(a.description);
    const bAnchor = isBalanceAnchor(b.description);
    if (aAnchor && !bAnchor) return -1;
    if (!aAnchor && bAnchor) return 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Reconcile an account: balance anchors set opening snapshots; transactions adjust balance.
 * Closing = opening anchor(s) + net IN/OUT movements (chronological walk).
 */
export function computeAccountLedger(
  movements: CashMovementLedgerInput[],
  asOfDate?: string,
): AccountLedgerResult {
  const filtered = asOfDate
    ? movements.filter((m) => m.movementDate.slice(0, 10) <= asOfDate)
    : [...movements];

  if (filtered.length === 0) {
    return { openingBalance: 0, openingDate: null, closingBalance: 0, transactions: [] };
  }

  const sorted = sortMovements(filtered);
  let running = 0;
  let openingBalance = 0;
  let openingDate: string | null = null;
  let seenTransaction = false;
  const transactions: AccountLedgerTransaction[] = [];

  for (const m of sorted) {
    const date = m.movementDate.slice(0, 10);

    if (isBalanceAnchor(m.description)) {
      running = m.amount;
      if (!seenTransaction) {
        openingBalance = running;
        openingDate = date;
      }
      continue;
    }

    if (!seenTransaction) {
      if (openingDate === null) {
        openingBalance = running;
        openingDate = date;
      }
      seenTransaction = true;
    }

    running += m.isInflow ? m.amount : -m.amount;
    transactions.push({
      id: m.id,
      transactionDate: date,
      description: m.description?.trim() || (m.isInflow ? 'Inflow' : 'Outflow'),
      category: categorizeTransaction(m.description),
      amount: m.amount,
      direction: m.isInflow ? 'IN' : 'OUT',
      runningBalance: round2(running),
    });
  }

  if (!seenTransaction) {
    const anchors = sorted.filter((m) => isBalanceAnchor(m.description));
    if (anchors.length > 0) {
      const last = anchors[anchors.length - 1];
      openingBalance = last.amount;
      openingDate = last.movementDate.slice(0, 10);
      running = last.amount;
    }
  }

  return {
    openingBalance: round2(openingBalance),
    openingDate,
    closingBalance: round2(running),
    transactions,
  };
}

export function accountClosingBalance(
  movements: CashMovementLedgerInput[],
  asOfDate: string,
): number {
  return computeAccountLedger(movements, asOfDate).closingBalance;
}

export function aggregateClosingBalance(
  bankAccountIds: string[],
  movements: CashMovementLedgerInput[],
  asOfDate: string,
): number {
  return round2(
    bankAccountIds.reduce((sum, id) => {
      const acct = movements.filter((m) => m.bankAccountId === id);
      return sum + accountClosingBalance(acct, asOfDate);
    }, 0),
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
