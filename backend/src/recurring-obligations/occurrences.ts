import { ObligationFrequency } from '@prisma/client';

/** Safety cap on roll-forward/projection iterations so a corrupt due date can't loop forever. */
const MAX_ITERATIONS = 1000;

function addStep(dateStr: string, frequency: ObligationFrequency): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'fortnightly':
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case 'annually':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Advances a due date forward by its frequency until it lands on or after asOfDate.
 * Obligations are edited rarely, so nextDueDate often drifts into the past between
 * edits — every consumer (forecast, AI context, notifications) needs the same
 * "what's actually next" answer rather than re-deriving it independently.
 */
export function rollForwardDueDate(
  dueDate: string,
  frequency: ObligationFrequency,
  asOfDate: string,
): string {
  let current = dueDate;
  let iterations = 0;
  while (current < asOfDate && iterations < MAX_ITERATIONS) {
    current = addStep(current, frequency);
    iterations += 1;
  }
  return current;
}

export interface ObligationOccurrence {
  dueDate: string;
  amount: number;
}

/**
 * Projects every occurrence of a recurring obligation between asOfDate and
 * horizonEndDate (inclusive), rolling the stored due date forward first.
 */
export function projectOccurrences(
  obligation: { nextDueDate: string; frequency: ObligationFrequency; amount: number },
  asOfDate: string,
  horizonEndDate: string,
): ObligationOccurrence[] {
  const occurrences: ObligationOccurrence[] = [];
  let current = rollForwardDueDate(obligation.nextDueDate, obligation.frequency, asOfDate);
  let iterations = 0;
  while (current <= horizonEndDate && iterations < MAX_ITERATIONS) {
    occurrences.push({ dueDate: current, amount: obligation.amount });
    current = addStep(current, obligation.frequency);
    iterations += 1;
  }
  return occurrences;
}
