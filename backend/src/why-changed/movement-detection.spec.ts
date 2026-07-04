import {
  buildActualMovements,
  buildSnapshotMovements,
  isMaterial,
  isMaterialRunwayChange,
} from './movement-detection';

describe('isMaterial', () => {
  it('is material when the absolute delta clears the $500 threshold, regardless of percent', () => {
    expect(isMaterial(600, 100000)).toBe(true); // 0.6% but $600
  });

  it('is material when the percent change clears 15%, regardless of small absolute size', () => {
    expect(isMaterial(50, 200)).toBe(true); // $50 but 25%
  });

  it('is not material when both the absolute and percent thresholds are missed', () => {
    expect(isMaterial(100, 10000)).toBe(false); // $100, 1%
  });

  it('treats a swing from zero as material based on absolute size alone', () => {
    expect(isMaterial(600, 0)).toBe(true);
    expect(isMaterial(100, 0)).toBe(false);
  });
});

describe('isMaterialRunwayChange', () => {
  it('is material at exactly 1 week and above', () => {
    expect(isMaterialRunwayChange(1)).toBe(true);
    expect(isMaterialRunwayChange(-1.5)).toBe(true);
  });

  it('is not material below 1 week', () => {
    expect(isMaterialRunwayChange(0.5)).toBe(false);
  });
});

describe('buildActualMovements', () => {
  it('returns nothing when fewer than 2 distinct periods exist', () => {
    const movements = buildActualMovements([
      { period: '2026-06', category: 'payroll', amount: 20000 },
    ]);
    expect(movements).toEqual([]);
  });

  it('compares only the two most recent periods, ignoring older ones', () => {
    const movements = buildActualMovements([
      { period: '2026-04', category: 'payroll', amount: 5000 }, // should be ignored
      { period: '2026-05', category: 'payroll', amount: 20000 },
      { period: '2026-06', category: 'payroll', amount: 26000 },
    ]);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ current: 26000, previous: 20000, delta: 6000 });
  });

  it('filters out immaterial category movements', () => {
    const movements = buildActualMovements([
      { period: '2026-05', category: 'expenses', amount: 10000 },
      { period: '2026-06', category: 'expenses', amount: 10050 }, // $50, 0.5% — immaterial
    ]);
    expect(movements).toEqual([]);
  });

  it('sorts material movements by absolute delta, largest first', () => {
    const movements = buildActualMovements([
      { period: '2026-05', category: 'payroll', amount: 20000 },
      { period: '2026-06', category: 'payroll', amount: 21000 }, // +1000
      { period: '2026-05', category: 'revenue', amount: 50000 },
      { period: '2026-06', category: 'revenue', amount: 40000 }, // -10000
    ]);
    expect(movements.map((m) => m.label)).toEqual(['Revenue', 'Payroll']);
  });
});

describe('buildSnapshotMovements', () => {
  const base = {
    asOfDate: '2026-06-27',
    currentCash: 100000,
    runwayWeeks: 10,
    overdueReceivables: 5000,
    upcomingPayables: 8000,
    freeAvailableCash: 20000,
  };

  it('returns nothing when nothing moved materially', () => {
    const current = { ...base, asOfDate: '2026-07-04' };
    expect(buildSnapshotMovements(current, base)).toEqual([]);
  });

  it('flags a material cash drop', () => {
    const current = { ...base, asOfDate: '2026-07-04', currentCash: 80000 };
    const movements = buildSnapshotMovements(current, base);
    expect(movements.some((m) => m.label === 'Cash position' && m.delta === -20000)).toBe(true);
  });

  it('flags a material runway change using the 1-week threshold', () => {
    const current = { ...base, asOfDate: '2026-07-04', runwayWeeks: 7 };
    const movements = buildSnapshotMovements(current, base);
    const runwayMovement = movements.find((m) => m.label === 'Cash runway (weeks)');
    expect(runwayMovement).toBeDefined();
    expect(runwayMovement?.delta).toBe(-3);
  });

  it('does not flag runway when both sides are within a week of each other', () => {
    const current = { ...base, asOfDate: '2026-07-04', runwayWeeks: 10.4 };
    const movements = buildSnapshotMovements(current, base);
    expect(movements.some((m) => m.label === 'Cash runway (weeks)')).toBe(false);
  });
});
