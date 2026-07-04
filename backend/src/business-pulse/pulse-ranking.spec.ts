import {
  buildCashBufferItem,
  buildCashInSettlementAccountsItem,
  buildDirectDebitPressureItem,
  buildExpectedReceiptItem,
  buildForecastShortfallItem,
  buildLowOperatingCashItem,
  buildObligationItem,
  buildOverduePayableItem,
  buildOverdueReceivableItem,
  buildPayrollRiskItem,
  buildSettlementDelayItem,
  buildStaleBankDataItem,
  rankPulseItems,
} from './pulse-ranking';

const ASOF = '2026-07-04';

describe('buildObligationItem', () => {
  it('marks a payroll obligation due today as critical', () => {
    const item = buildObligationItem(
      { obligationId: 'ob-1', name: 'Payroll run', category: 'payroll', amount: 20000, dueDate: ASOF },
      ASOF,
      'USD',
    );
    expect(item.severity).toBe('critical');
    expect(item.category).toBe('obligation_due');
    expect(item.linkPath).toBe('/settings?tab=obligations');
    expect(item.name).toBe('Payroll run');
    expect(item.amount).toBe(20000);
    expect(item.daysUntilDue).toBe(0);
  });

  it('marks an obligation due in 10 days as info, not critical', () => {
    const item = buildObligationItem(
      { obligationId: 'ob-2', name: 'Insurance', category: 'insurance', amount: 500, dueDate: '2026-07-14' },
      ASOF,
      'USD',
    );
    expect(item.severity).toBe('info');
    expect(item.daysUntilDue).toBe(10);
  });

  it('scores payroll higher than a subscription due on the same day', () => {
    const payroll = buildObligationItem(
      { obligationId: 'ob-3', name: 'Payroll', category: 'payroll', amount: 20000, dueDate: ASOF },
      ASOF,
      'USD',
    );
    const subscription = buildObligationItem(
      { obligationId: 'ob-4', name: 'SaaS tool', category: 'subscription', amount: 20000, dueDate: ASOF },
      ASOF,
      'USD',
    );
    expect(payroll.score).toBeGreaterThan(subscription.score);
  });
});

describe('buildOverduePayableItem', () => {
  it('marks an overdue payroll-priority bill as critical regardless of days overdue', () => {
    const item = buildOverduePayableItem(
      {
        id: 'p-1',
        counterparty: 'Payroll processor',
        outstandingAmount: 5000,
        dueDate: '2026-07-01',
        daysOverdue: 3,
        supplierPriority: 'payroll',
      },
      'USD',
    );
    expect(item.severity).toBe('critical');
    expect(item.name).toBe('Payroll processor');
    expect(item.daysOverdue).toBe(3);
    expect(item.isPayrollPriority).toBe(true);
  });

  it('marks a flexible-priority bill overdue by a few days as warning, not critical', () => {
    const item = buildOverduePayableItem(
      {
        id: 'p-2',
        counterparty: 'Office supplies co',
        outstandingAmount: 500,
        dueDate: '2026-07-01',
        daysOverdue: 3,
        supplierPriority: 'flexible',
      },
      'USD',
    );
    expect(item.severity).toBe('warning');
    expect(item.isPayrollPriority).toBe(false);
  });

  it('escalates a flexible-priority bill to critical once overdue past 30 days', () => {
    const item = buildOverduePayableItem(
      {
        id: 'p-3',
        counterparty: 'Office supplies co',
        outstandingAmount: 500,
        dueDate: '2026-05-01',
        daysOverdue: 40,
        supplierPriority: 'flexible',
      },
      'USD',
    );
    expect(item.severity).toBe('critical');
  });
});

describe('buildOverdueReceivableItem', () => {
  it('marks a receivable overdue by 61 days as critical', () => {
    const item = buildOverdueReceivableItem(
      { id: 'r-1', counterparty: 'Client A', outstandingAmount: 8000, dueDate: '2026-05-01', daysOverdue: 61 },
      'USD',
    );
    expect(item.severity).toBe('critical');
    expect(item.name).toBe('Client A');
  });

  it('marks a receivable overdue by 10 days as warning', () => {
    const item = buildOverdueReceivableItem(
      { id: 'r-2', counterparty: 'Client B', outstandingAmount: 8000, dueDate: '2026-06-24', daysOverdue: 10 },
      'USD',
    );
    expect(item.severity).toBe('warning');
  });
});

describe('buildExpectedReceiptItem', () => {
  it('is always info severity — reassurance, not urgency', () => {
    const item = buildExpectedReceiptItem(
      { id: 'r-3', counterparty: 'Client C', outstandingAmount: 15000, dueDate: '2026-07-10' },
      ASOF,
      'USD',
    );
    expect(item.severity).toBe('info');
    expect(item.category).toBe('expected_receipt');
    expect(item.daysUntilDue).toBe(6);
  });
});

describe('buildCashBufferItem', () => {
  it('returns null when cash buffer is healthy (no runway risk, positive free cash)', () => {
    expect(buildCashBufferItem(50000, 20, 'USD')).toBeNull();
  });

  it('returns a critical item when free available cash is negative', () => {
    const item = buildCashBufferItem(-5000, 10, 'USD');
    expect(item).not.toBeNull();
    expect(item?.severity).toBe('critical');
    expect(item?.amount).toBe(-5000);
  });

  it('returns a warning item when runway is under 6 weeks even with positive free cash', () => {
    const item = buildCashBufferItem(2000, 4, 'USD');
    expect(item).not.toBeNull();
    expect(item?.severity).toBe('warning');
    expect(item?.runwayWeeks).toBe(4);
  });
});

describe('buildForecastShortfallItem', () => {
  it('returns null when no forecast week goes negative', () => {
    const lines = [
      { weekIndex: 1, weekStart: '2026-07-06', closingCash: 5000 },
      { weekIndex: 2, weekStart: '2026-07-13', closingCash: 6000 },
    ];
    expect(buildForecastShortfallItem(lines, 'USD')).toBeNull();
  });

  it('flags the first (earliest) negative week, not just the most negative one', () => {
    const lines = [
      { weekIndex: 3, weekStart: '2026-07-20', closingCash: -20000 },
      { weekIndex: 1, weekStart: '2026-07-06', closingCash: -500 },
      { weekIndex: 2, weekStart: '2026-07-13', closingCash: 4000 },
    ];
    const item = buildForecastShortfallItem(lines, 'USD');
    expect(item?.weekIndex).toBe(1);
    expect(item?.amount).toBe(-500);
  });

  it('is critical when the shortfall is within 4 weeks, warning otherwise', () => {
    const soon = buildForecastShortfallItem(
      [{ weekIndex: 2, weekStart: '2026-07-13', closingCash: -100 }],
      'USD',
    );
    const later = buildForecastShortfallItem(
      [{ weekIndex: 9, weekStart: '2026-09-01', closingCash: -100 }],
      'USD',
    );
    expect(soon?.severity).toBe('critical');
    expect(later?.severity).toBe('warning');
  });
});

describe('buildStaleBankDataItem', () => {
  it('returns null when there is no bank data at all (null daysSinceUpdate)', () => {
    expect(buildStaleBankDataItem(null, 'USD')).toBeNull();
  });

  it('returns null when bank data is fresh (14 days or fewer)', () => {
    expect(buildStaleBankDataItem(14, 'USD')).toBeNull();
  });

  it('returns an info-severity item once bank data is more than 14 days old', () => {
    const item = buildStaleBankDataItem(21, 'USD');
    expect(item).not.toBeNull();
    expect(item?.severity).toBe('info');
    expect(item?.daysSinceUpdate).toBe(21);
  });
});

describe('rankPulseItems', () => {
  it('caps the list at 5 items, keeping the highest-scoring ones', () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      id: `item-${i}`,
      severity: 'info' as const,
      category: 'obligation_due' as const,
      linkPath: '/',
      score: i,
      name: `Item ${i}`,
      amount: 0,
      currency: 'USD',
    }));
    const ranked = rankPulseItems(candidates, 5);
    expect(ranked).toHaveLength(5);
    // Highest scores (7,6,5,4,3) should survive; lowest (0,1,2) should be cut.
    expect(ranked.map((i) => i.id)).toEqual(['item-7', 'item-6', 'item-5', 'item-4', 'item-3']);
  });

  it('does not mutate the input array', () => {
    const candidates = [
      { id: 'a', severity: 'info' as const, category: 'obligation_due' as const, linkPath: '/', score: 1, name: '', amount: 0, currency: 'USD' },
      { id: 'b', severity: 'info' as const, category: 'obligation_due' as const, linkPath: '/', score: 2, name: '', amount: 0, currency: 'USD' },
    ];
    const original = [...candidates];
    rankPulseItems(candidates, 5);
    expect(candidates).toEqual(original);
  });
});

describe('buildPayrollRiskItem', () => {
  it('returns null when payroll is comfortable or covered', () => {
    expect(
      buildPayrollRiskItem({ status: 'comfortable', bufferAfterPayroll: 5000, nextPayrollDate: ASOF }, 'AUD'),
    ).toBeNull();
    expect(
      buildPayrollRiskItem({ status: 'covered', bufferAfterPayroll: 0, nextPayrollDate: ASOF }, 'AUD'),
    ).toBeNull();
    expect(buildPayrollRiskItem({ status: null, bufferAfterPayroll: 0, nextPayrollDate: null }, 'AUD')).toBeNull();
  });

  it('flags critical when payroll is a shortfall', () => {
    const item = buildPayrollRiskItem(
      { status: 'shortfall', bufferAfterPayroll: -4200, nextPayrollDate: ASOF },
      'AUD',
    );
    expect(item?.severity).toBe('critical');
    expect(item?.category).toBe('payroll_risk');
    expect(item?.amount).toBe(-4200);
  });
});

describe('buildDirectDebitPressureItem', () => {
  it('returns null when upcoming debits are a small share of operating cash', () => {
    expect(buildDirectDebitPressureItem(1000, 50000, 'AUD')).toBeNull();
  });

  it('flags warning when upcoming debits are 30%+ of operating cash', () => {
    const item = buildDirectDebitPressureItem(20000, 50000, 'AUD');
    expect(item?.severity).toBe('warning');
    expect(item?.category).toBe('direct_debit_pressure');
  });
});

describe('buildSettlementDelayItem', () => {
  it('always returns a warning item for a given delayed settlement', () => {
    const item = buildSettlementDelayItem(
      { settlementId: 'set-1', source: 'NDIS settlement', amount: 42500, expectedDate: '2026-06-30', status: 'expected' },
      'AUD',
    );
    expect(item.severity).toBe('warning');
    expect(item.category).toBe('settlement_delay');
    expect(item.name).toBe('NDIS settlement');
  });
});

describe('buildCashInSettlementAccountsItem', () => {
  it('returns null when clearing funds are a small share of total cash', () => {
    expect(buildCashInSettlementAccountsItem(5000, 100000, 'AUD')).toBeNull();
  });

  it('flags info when clearing funds are 20%+ of total cash', () => {
    const item = buildCashInSettlementAccountsItem(30000, 100000, 'AUD');
    expect(item?.severity).toBe('info');
    expect(item?.category).toBe('cash_in_settlement_accounts');
  });
});

describe('buildLowOperatingCashItem', () => {
  it('returns null when operating cash covers near-term obligations', () => {
    expect(buildLowOperatingCashItem(20000, 5000, 'AUD')).toBeNull();
  });

  it('flags critical when operating cash is below near-term obligations', () => {
    const item = buildLowOperatingCashItem(3000, 12000, 'AUD');
    expect(item?.severity).toBe('critical');
    expect(item?.category).toBe('low_operating_cash');
  });
});
