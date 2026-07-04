import { projectOccurrences, rollForwardDueDate } from './occurrences';

describe('rollForwardDueDate', () => {
  it('leaves a due date unchanged when it is already on or after asOfDate', () => {
    expect(rollForwardDueDate('2026-07-10', 'monthly', '2026-07-04')).toBe('2026-07-10');
    expect(rollForwardDueDate('2026-07-04', 'monthly', '2026-07-04')).toBe('2026-07-04');
  });

  it('rolls a stale weekly due date forward to the next occurrence on/after asOfDate', () => {
    // Stale by a single missed cycle.
    expect(rollForwardDueDate('2026-06-27', 'weekly', '2026-07-04')).toBe('2026-07-04');
    // Stale by several missed cycles.
    expect(rollForwardDueDate('2026-05-01', 'weekly', '2026-07-04')).toBe('2026-07-10');
  });

  it('rolls a stale monthly due date forward across a year boundary', () => {
    // 2025-12-15 -> 2026-01-15 (still stale) -> 2026-02-15 (>= asOfDate).
    expect(rollForwardDueDate('2025-12-15', 'monthly', '2026-02-01')).toBe('2026-02-15');
  });

  it('rolls a stale annual due date forward by whole years', () => {
    // 2023 -> 2024 -> 2025 -> 2026-03-01 (still < asOfDate) -> 2027-03-01.
    expect(rollForwardDueDate('2023-03-01', 'annually', '2026-07-04')).toBe('2027-03-01');
  });

  it('rolls a stale quarterly due date forward', () => {
    expect(rollForwardDueDate('2026-01-15', 'quarterly', '2026-07-04')).toBe('2026-07-15');
  });

  it('rolls a stale fortnightly due date forward', () => {
    // 2026-06-01 -> 06-15 -> 06-29 (still < asOfDate) -> 07-13.
    expect(rollForwardDueDate('2026-06-01', 'fortnightly', '2026-07-04')).toBe('2026-07-13');
  });
});

describe('projectOccurrences', () => {
  it('projects every monthly occurrence within the horizon, rolling the stale start forward first', () => {
    // 2026-05-01 -> 06-01 -> 07-01 (still < 2026-07-04) -> 08-01 (first occurrence in horizon).
    const occurrences = projectOccurrences(
      { nextDueDate: '2026-05-01', frequency: 'monthly', amount: 1000 },
      '2026-07-04',
      '2026-09-30',
    );
    expect(occurrences.map((o) => o.dueDate)).toEqual(['2026-08-01', '2026-09-01']);
    expect(occurrences.every((o) => o.amount === 1000)).toBe(true);
  });

  it('excludes an occurrence that falls exactly one day after the horizon end', () => {
    const occurrences = projectOccurrences(
      { nextDueDate: '2026-07-01', frequency: 'weekly', amount: 500 },
      '2026-07-04',
      '2026-07-15',
    );
    // Rolled forward to 2026-07-08, then 2026-07-15 (on boundary, included), then 2026-07-22 (excluded).
    expect(occurrences.map((o) => o.dueDate)).toEqual(['2026-07-08', '2026-07-15']);
  });

  it('includes an occurrence landing exactly on the horizon end (inclusive boundary)', () => {
    const occurrences = projectOccurrences(
      { nextDueDate: '2026-07-15', frequency: 'weekly', amount: 250 },
      '2026-07-04',
      '2026-07-15',
    );
    expect(occurrences.map((o) => o.dueDate)).toEqual(['2026-07-15']);
  });

  it('returns no occurrences when the horizon ends before the rolled-forward due date', () => {
    const occurrences = projectOccurrences(
      { nextDueDate: '2026-01-01', frequency: 'annually', amount: 5000 },
      '2026-07-04',
      '2026-07-10',
    );
    expect(occurrences).toEqual([]);
  });

  it('projects annual occurrences correctly across a multi-year horizon', () => {
    const occurrences = projectOccurrences(
      { nextDueDate: '2024-03-01', frequency: 'annually', amount: 2000 },
      '2026-07-04',
      '2028-04-01',
    );
    expect(occurrences.map((o) => o.dueDate)).toEqual(['2027-03-01', '2028-03-01']);
  });
});
