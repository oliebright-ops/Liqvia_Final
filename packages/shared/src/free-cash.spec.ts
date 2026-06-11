import { describe, expect, it } from 'vitest';
import { buildFreeCashReport, evaluateFreeCashAlerts } from './free-cash';

describe('buildFreeCashReport', () => {
  const asOf = '2026-06-11';
  const recurringWeekly = Array.from({ length: 13 }, (_, i) => ({
    weekIndex: i + 1,
    outflows: 100_000,
  }));

  it('increases fixed outflows as the horizon widens when recurring burn is present', () => {
    const payables = [
      { dueDate: '2026-05-01', outstandingAmount: 1_000_000 },
      { dueDate: '2026-06-20', outstandingAmount: 2_000_000 },
    ];

    const base = {
      asOfDate: asOf,
      openingCash: 22_120_000,
      forecastLookbackWeeks: 4,
      weeklyAdjustments: recurringWeekly,
      receivables: [],
      payables: payables.map((p, i) => ({
        id: `ap-${i}`,
        counterparty: 'Supplier',
        dueDate: p.dueDate,
        outstandingAmount: p.outstandingAmount,
      })),
    };

    const short = buildFreeCashReport(22_120_000, { ...base, horizonWeeks: 4 }, 1_000_000, 'RUB');
    const long = buildFreeCashReport(22_120_000, { ...base, horizonWeeks: 8 }, 1_000_000, 'RUB');

    expect(short.fixedOutflowsHorizon).toBeLessThan(long.fixedOutflowsHorizon);
    expect(short.freeAvailableCash).toBeGreaterThan(long.freeAvailableCash);
    expect(short.weeks).toHaveLength(4);
    expect(long.weeks).toHaveLength(8);
    expect(long.fixedOutflowsHorizon - short.fixedOutflowsHorizon).toBe(400_000);
  });

  it('matches Samara-like data: AP flat but total outflows grow with horizon', () => {
    const payables = [
      { dueDate: '2026-05-01', outstandingAmount: 9_839_400 },
      { dueDate: '2026-06-16', outstandingAmount: 514_200 },
      { dueDate: '2026-06-22', outstandingAmount: 341_400 },
    ];
    const weeklyAdjustments = Array.from({ length: 13 }, (_, i) => ({
      weekIndex: i + 1,
      outflows: 888_700,
    }));

    const input = {
      asOfDate: asOf,
      openingCash: 22_119_600,
      forecastLookbackWeeks: 4,
      weeklyAdjustments,
      receivables: [],
      payables: payables.map((p, i) => ({
        id: `ap-${i}`,
        counterparty: 'Supplier',
        dueDate: p.dueDate,
        outstandingAmount: p.outstandingAmount,
      })),
    };

    const at4 = buildFreeCashReport(22_119_600, { ...input, horizonWeeks: 4 }, 9_839_400, 'RUB');
    const at8 = buildFreeCashReport(22_119_600, { ...input, horizonWeeks: 8 }, 9_839_400, 'RUB');

    expect(at4.apOutflowsHorizon).toBe(at8.apOutflowsHorizon);
    expect(at4.fixedOutflowsHorizon).toBeLessThan(at8.fixedOutflowsHorizon);
    expect(at4.freeAvailableCash).toBeGreaterThan(at8.freeAvailableCash);
    expect(at8.fixedOutflowsHorizon - at4.fixedOutflowsHorizon).toBe(888_700 * 4);
  });
});

describe('evaluateFreeCashAlerts', () => {
  it('flags negative free cash as critical', () => {
    const alerts = evaluateFreeCashAlerts(-50_000, 1_000_000, 8);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe('free_cash_risk');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].params?.kind).toBe('negative');
  });

  it('flags low free cash as warning', () => {
    const alerts = evaluateFreeCashAlerts(50_000, 1_000_000, 13);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].params?.kind).toBe('low');
  });

  it('returns no alert when free cash is healthy', () => {
    expect(evaluateFreeCashAlerts(500_000, 1_000_000, 4)).toHaveLength(0);
  });
});
