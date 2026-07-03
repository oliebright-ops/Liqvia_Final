import { OnboardingService } from './onboarding.service';

describe('OnboardingService opening balance anchor date', () => {
  const service = new OnboardingService({} as never, {} as never, {} as never, {} as never);

  function anchorDate(asOfDate: string): Date {
    return (service as unknown as { openingAnchorDate: (d: string) => Date }).openingAnchorDate(
      asOfDate,
    );
  }

  it('backdates the anchor 5 years before the given as-of date', () => {
    const result = anchorDate('2026-07-03');
    expect(result.getUTCFullYear()).toBe(2021);
    expect(result.getUTCMonth()).toBe(6); // July, 0-indexed
    expect(result.getUTCDate()).toBe(3);
  });

  it('sorts strictly before any realistic historical bank_transactions.csv import', () => {
    const asOfDate = '2026-07-03';
    const anchor = anchorDate(asOfDate);
    // A generous historical backfill (2 years of bank history) should still land after the anchor.
    const earliestRealisticImport = new Date('2024-07-03T00:00:00.000Z');
    expect(anchor.getTime()).toBeLessThan(earliestRealisticImport.getTime());
  });

  it('handles year-boundary as-of dates correctly (leap year safety)', () => {
    const result = anchorDate('2028-02-29');
    // 2023 is not a leap year; JS Date normalizes Feb 29 -> Mar 1, which is fine as long
    // as it still lands safely before any realistic transaction history.
    expect(result.getUTCFullYear()).toBe(2023);
    expect(result.getTime()).toBeLessThan(new Date('2026-01-01T00:00:00.000Z').getTime());
  });
});
