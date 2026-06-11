import { buildForecastModel, dateToWeekIndex, scheduleArApEntries } from '@liqvia2/shared';
import { ForecastCalculationService } from './forecast-calculation.service';

describe('ForecastCalculationService', () => {
  const service = new ForecastCalculationService();

  it('schedules AR/AP by due date into forecast weeks', () => {
    const { arByWeek, apByWeek } = scheduleArApEntries({
      asOfDate: '2026-06-01',
      openingCash: 100_000,
      receivables: [
        {
          id: 'ar-1',
          counterparty: 'Acme',
          dueDate: '2026-06-10',
          outstandingAmount: 20_000,
        },
      ],
      payables: [
        {
          id: 'ap-1',
          counterparty: 'Payroll',
          dueDate: '2026-06-06',
          outstandingAmount: 34_000,
        },
      ],
    });

    expect(apByWeek[0]).toBe(34_000);
    expect(arByWeek[1]).toBeGreaterThan(0);
  });

  it('applies opening + inflows - outflows = closing each week', () => {
    const lines = service.calculateBaselineForecast({
      asOfDate: '2026-01-01',
      openingCash: 50_000,
      receivables: [
        { outstandingAmount: 10_000, invoiceDate: '2026-01-01', dueDate: '2026-01-20' },
      ],
      payables: [
        {
          outstandingAmount: 5_000,
          dueDate: '2026-01-15',
          supplierPriority: 'payroll',
        },
      ],
    });

    expect(lines).toHaveLength(13);
    for (const line of lines) {
      expect(line.closingCash).toBeCloseTo(
        line.openingCash + line.forecastInflows - line.forecastOutflows,
        2,
      );
    }
    expect(lines[0].openingCash).toBe(50_000);
    expect(lines[1].openingCash).toBe(lines[0].closingCash);
  });

  it('marks weeks with negative projected closing cash as critical', () => {
    const result = buildForecastModel({
      asOfDate: '2026-06-01',
      openingCash: 20_000,
      receivables: [],
      payables: [
        {
          id: 'ap-1',
          counterparty: 'Payroll',
          dueDate: '2026-06-06',
          outstandingAmount: 35_000,
        },
      ],
    });

    const stressedWeek = result.weeks.find((l) => l.closingCash < 0);
    expect(stressedWeek).toBeDefined();
    expect(stressedWeek?.liquidityStatus).toBe('critical');
  });

  it('improves liquidity status as closing balance recovers', () => {
    const result = buildForecastModel({
      asOfDate: '2026-06-01',
      openingCash: 225_000,
      receivables: [
        { id: '1', counterparty: 'A', dueDate: '2026-06-12', outstandingAmount: 32_400 },
        { id: '2', counterparty: 'B', dueDate: '2026-06-19', outstandingAmount: 10_800 },
      ],
      payables: [
        { id: '3', counterparty: 'Payroll', dueDate: '2026-06-06', outstandingAmount: 34_000 },
      ],
    });

    const week1 = result.weeks[0];
    const week2 = result.weeks[1];
    expect(week1.closingCash).toBeLessThan(week2.closingCash);
    const rank = { healthy: 0, moderate: 1, high_risk: 2, critical: 3 };
    expect(rank[week2.liquidityStatus]).toBeLessThanOrEqual(rank[week1.liquidityStatus]);
  });

  it('maps due dates to week indices', () => {
    const start = '2026-06-02';
    expect(dateToWeekIndex(start, '2026-06-06', 13)).toBe(1);
    expect(dateToWeekIndex(start, '2026-06-14', 13)).toBe(2);
  });
});
