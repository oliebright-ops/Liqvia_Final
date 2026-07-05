import {
  getFutureWeekPeriods,
  getPastWeekPeriods,
  type RollingBudgetCategory,
} from '@liqvia2/shared';

export interface DemoArLine {
  customer: string;
  invoice: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
}

export interface DemoApLine {
  supplier: string;
  bill: string;
  billDate: string;
  dueDate: string;
  amount: number;
  priority: 'payroll' | 'tax' | 'critical' | 'flexible' | 'non_essential';
}

export interface DemoPackProfile {
  slug: string;
  currency: string;
  operatingMask: string;
  reserveMask: string;
  cash: { operating: number; reserve: number };
  monthly: { revenue: number; payroll: number; expenses: number };
  ar: DemoArLine[];
  ap: DemoApLine[];
  /** Per-week revenue multiplier (length 14) — defaults to flat 1.0 */
  revenueSeasonality?: number[];
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekMidDate(period: string, asOfDate: string): string {
  const past = getPastWeekPeriods(asOfDate);
  const future = getFutureWeekPeriods(asOfDate);
  const idx = [...past, ...future].indexOf(period);
  if (idx === -1) return asOfDate;
  const offset = idx < past.length ? past.length - idx : -(idx - past.length + 1);
  return addDays(asOfDate, offset * 7);
}

function weeklyAmounts(
  periods: string[],
  category: RollingBudgetCategory,
  accountCode: string,
  weeklyTotals: number[],
): Array<Array<string | number>> {
  return periods.map((period, i) => [period, category, accountCode, Math.round(weeklyTotals[i])]);
}

export function buildDemoPackFiles(profile: DemoPackProfile, asOfDate = new Date().toISOString().slice(0, 10)) {
  const month = asOfDate.slice(0, 7);
  const balanceDate = asOfDate;
  const pastWeeks = getPastWeekPeriods(asOfDate);
  const futureWeeks = getFutureWeekPeriods(asOfDate);
  const seasonality =
    profile.revenueSeasonality ??
    Array.from({ length: pastWeeks.length }, () => 1);

  const weeklyRevenue = pastWeeks.map((_, i) => {
    const base = profile.monthly.revenue / 4.33;
    return base * seasonality[i];
  });
  const weeklyPayroll = pastWeeks.map(() => profile.monthly.payroll / 4.33);
  const weeklyExpenses = pastWeeks.map(() => profile.monthly.expenses / 4.33);

  const trial_balance = toCsv(
    ['Period', 'Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit'],
    [
      [month, '1000', 'Cash', 'asset', profile.cash.operating + profile.cash.reserve, 0],
      [month, '1200', 'Accounts Receivable', 'asset', profile.ar.reduce((s, r) => s + r.amount, 0), 0],
      [month, '2000', 'Accounts Payable', 'liability', 0, profile.ap.reduce((s, r) => s + r.amount, 0)],
      [month, '4000', 'Operating Revenue', 'revenue', 0, profile.monthly.revenue],
      [month, '5000', 'Payroll', 'expense', profile.monthly.payroll, 0],
      [month, '6000', 'Operating Expenses', 'expense', profile.monthly.expenses, 0],
    ],
  );

  const bank_balances = toCsv(
    ['Bank Account Name', 'Account Number Masked', 'Currency', 'Balance Date', 'Current Balance'],
    [
      ['Operating Account', profile.operatingMask, profile.currency, balanceDate, profile.cash.operating],
      ['Reserve Account', profile.reserveMask, profile.currency, balanceDate, profile.cash.reserve],
    ],
  );

  const ar_ageing = toCsv(
    [
      'Customer Name',
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Outstanding Amount',
      'Currency',
    ],
    profile.ar.map((row) => [
      row.customer,
      row.invoice,
      row.invoiceDate,
      row.dueDate,
      row.amount,
      profile.currency,
    ]),
  );

  const ap_ageing = toCsv(
    [
      'Supplier Name',
      'Bill Number',
      'Bill Date',
      'Due Date',
      'Outstanding Amount',
      'Supplier Priority',
      'Currency',
    ],
    profile.ap.map((row) => [
      row.supplier,
      row.bill,
      row.billDate,
      row.dueDate,
      row.amount,
      row.priority,
      profile.currency,
    ]),
  );

  const weeklyRows = [
    ...weeklyAmounts(pastWeeks, 'revenue', '4000', weeklyRevenue),
    ...weeklyAmounts(pastWeeks, 'payroll', '5000', weeklyPayroll),
    ...weeklyAmounts(pastWeeks, 'expenses', '6000', weeklyExpenses),
  ];

  const weekly_actuals = toCsv(
    ['Period', 'Category', 'Account Code', 'Actual Amount'],
    weeklyRows,
  );

  const budgetMultiplier = 1.04;
  const priorRows = [
    ...weeklyAmounts(
      pastWeeks,
      'revenue',
      '4000',
      weeklyRevenue.map((v) => v * budgetMultiplier),
    ),
    ...weeklyAmounts(
      pastWeeks,
      'payroll',
      '5000',
      weeklyPayroll.map((v) => v * 1.02),
    ),
    ...weeklyAmounts(
      pastWeeks,
      'expenses',
      '6000',
      weeklyExpenses.map((v) => v * 1.03),
    ),
  ];

  const prior_period_budget = toCsv(
    ['Period', 'Category', 'Account Code', 'Budget Amount'],
    priorRows,
  );

  const futureRevenue = futureWeeks.map(() => (profile.monthly.revenue / 4.33) * 1.05);
  const futurePayroll = futureWeeks.map(() => (profile.monthly.payroll / 4.33) * 1.02);
  const futureExpenses = futureWeeks.map(() => (profile.monthly.expenses / 4.33) * 1.01);

  const rollingRows = [
    ...weeklyAmounts(futureWeeks, 'revenue', '4000', futureRevenue),
    ...weeklyAmounts(futureWeeks, 'payroll', '5000', futurePayroll),
    ...weeklyAmounts(futureWeeks, 'expenses', '6000', futureExpenses),
  ];

  const rolling_budget = toCsv(
    ['Period', 'Category', 'Account Code', 'Budget Amount'],
    rollingRows,
  );

  const txRows: Array<Array<string | number>> = [];
  let txId = 1;
  for (const period of pastWeeks.slice(-8)) {
    const txDate = weekMidDate(period, asOfDate);
    const rev = weeklyRevenue[pastWeeks.indexOf(period)] ?? 0;
    const pay = weeklyPayroll[pastWeeks.indexOf(period)] ?? 0;
    const exp = weeklyExpenses[pastWeeks.indexOf(period)] ?? 0;

    txRows.push([
      'Operating Account',
      profile.operatingMask,
      txDate,
      `Customer receipts ${period}`,
      Math.round(rev * 0.85),
      'IN',
    ]);
    txRows.push([
      'Operating Account',
      profile.operatingMask,
      addDays(txDate, 1),
      `Payroll ${period}`,
      Math.round(pay),
      'OUT',
    ]);
    txRows.push([
      'Operating Account',
      profile.operatingMask,
      addDays(txDate, 2),
      `Vendor payments ${period}`,
      Math.round(exp * 0.7),
      'OUT',
    ]);

    if (txId % 3 === 0) {
      txRows.push([
        'Reserve Account',
        profile.reserveMask,
        addDays(txDate, 3),
        `Reserve sweep ${period}`,
        Math.round(rev * 0.05),
        'IN',
      ]);
    }
    txId++;
  }

  const bank_transactions = toCsv(
    [
      'Bank Account Name',
      'Account Number Masked',
      'Transaction Date',
      'Description',
      'Amount',
      'Direction',
    ],
    txRows,
  );

  return {
    trial_balance,
    bank_balances,
    ar_ageing,
    ap_ageing,
    weekly_actuals,
    prior_period_budget,
    rolling_budget,
    bank_transactions,
  };
}

export const DEMO_PACK_PROFILES: DemoPackProfile[] = [
  {
    slug: 'demo-consulting',
    currency: 'USD',
    operatingMask: '****4521',
    reserveMask: '****8832',
    cash: { operating: 165000, reserve: 60000 },
    monthly: { revenue: 145000, payroll: 68000, expenses: 22000 },
    ar: [
      { customer: 'Acme Corp', invoice: 'INV-2001', invoiceDate: '2026-05-15', dueDate: '2026-06-14', amount: 42000 },
      { customer: 'Beta LLC', invoice: 'INV-2002', invoiceDate: '2026-05-20', dueDate: '2026-06-19', amount: 28000 },
      { customer: 'Gamma Partners', invoice: 'INV-2003', invoiceDate: '2026-05-28', dueDate: '2026-06-27', amount: 18000 },
    ],
    ap: [
      { supplier: 'Payroll Provider', bill: 'PAY-05', billDate: '2026-05-25', dueDate: '2026-06-05', amount: 34000, priority: 'payroll' },
      { supplier: 'Cloud Hosting', bill: 'BILL-201', billDate: '2026-05-18', dueDate: '2026-06-17', amount: 4200, priority: 'critical' },
      { supplier: 'Office Supplies Co', bill: 'BILL-202', billDate: '2026-05-22', dueDate: '2026-06-21', amount: 1500, priority: 'flexible' },
    ],
    revenueSeasonality: [0.92, 0.95, 1.0, 1.02, 1.05, 1.03, 0.98, 1.0, 1.04, 1.06, 1.01, 0.97, 1.03, 1.05],
  },
  {
    slug: 'brightspark-retail',
    currency: 'USD',
    operatingMask: '****1190',
    reserveMask: '****7721',
    cash: { operating: 42000, reserve: 10000 },
    monthly: { revenue: 210000, payroll: 72000, expenses: 95000 },
    ar: [
      { customer: 'Metro Stores', invoice: 'INV-R101', invoiceDate: '2026-04-28', dueDate: '2026-05-28', amount: 38000 },
      { customer: 'City Outfitters', invoice: 'INV-R102', invoiceDate: '2026-05-10', dueDate: '2026-06-09', amount: 26000 },
      { customer: 'Online Marketplace', invoice: 'INV-R103', invoiceDate: '2026-05-22', dueDate: '2026-06-21', amount: 19000 },
    ],
    ap: [
      { supplier: 'Inventory Wholesale', bill: 'PO-881', billDate: '2026-05-12', dueDate: '2026-06-01', amount: 54000, priority: 'critical' },
      { supplier: 'Payroll Services', bill: 'PAY-R05', billDate: '2026-05-26', dueDate: '2026-06-05', amount: 36000, priority: 'payroll' },
      { supplier: 'Mall Rent Ltd', bill: 'RENT-05', billDate: '2026-05-01', dueDate: '2026-06-01', amount: 18000, priority: 'critical' },
    ],
    revenueSeasonality: [1.15, 1.12, 1.08, 0.95, 0.9, 0.88, 0.92, 1.0, 1.1, 1.18, 1.2, 1.05, 0.98, 1.12],
  },
  {
    slug: 'nordwind-manufacturing',
    currency: 'EUR',
    operatingMask: '****3344',
    reserveMask: '****9012',
    cash: { operating: 98000, reserve: 35000 },
    monthly: { revenue: 320000, payroll: 125000, expenses: 88000 },
    ar: [
      { customer: 'Rhein Logistics', invoice: 'NW-4501', invoiceDate: '2026-03-15', dueDate: '2026-04-14', amount: 72000 },
      { customer: 'Alpine Components', invoice: 'NW-4502', invoiceDate: '2026-04-20', dueDate: '2026-05-20', amount: 54000 },
      { customer: 'Nordic Steel AB', invoice: 'NW-4503', invoiceDate: '2026-05-18', dueDate: '2026-06-17', amount: 38000 },
    ],
    ap: [
      { supplier: 'Steel Suppliers GmbH', bill: 'NW-AP01', billDate: '2026-05-08', dueDate: '2026-06-07', amount: 46000, priority: 'critical' },
      { supplier: 'Payroll AG', bill: 'NW-PAY05', billDate: '2026-05-25', dueDate: '2026-06-05', amount: 62000, priority: 'payroll' },
      { supplier: 'Energy Provider', bill: 'NW-EN05', billDate: '2026-05-14', dueDate: '2026-06-13', amount: 22000, priority: 'critical' },
    ],
    revenueSeasonality: [1.02, 1.0, 0.98, 1.01, 1.03, 1.0, 0.99, 1.02, 1.04, 1.01, 0.97, 1.0, 1.03, 1.02],
  },
  {
    slug: 'cloudpeak-saas',
    currency: 'USD',
    operatingMask: '****6601',
    reserveMask: '****4409',
    cash: { operating: 28000, reserve: 10000 },
    monthly: { revenue: 42000, payroll: 78000, expenses: 42000 },
    ar: [
      { customer: 'Startup Hub', invoice: 'CP-1001', invoiceDate: '2026-05-05', dueDate: '2026-06-04', amount: 12000 },
      { customer: 'Growth Labs', invoice: 'CP-1002', invoiceDate: '2026-05-19', dueDate: '2026-06-18', amount: 9000 },
    ],
    ap: [
      { supplier: 'AWS Cloud', bill: 'CP-CLOUD', billDate: '2026-05-10', dueDate: '2026-06-09', amount: 14000, priority: 'critical' },
      { supplier: 'Payroll Inc', bill: 'CP-PAY05', billDate: '2026-05-26', dueDate: '2026-06-05', amount: 39000, priority: 'payroll' },
      { supplier: 'Ad Platform', bill: 'CP-ADS05', billDate: '2026-05-15', dueDate: '2026-06-14', amount: 18000, priority: 'flexible' },
    ],
    revenueSeasonality: [0.9, 0.92, 0.95, 0.98, 1.0, 1.02, 1.05, 1.08, 1.1, 1.12, 1.15, 1.1, 1.05, 1.08],
  },
  {
    // Mixed cash model (businessMode set to 'mixed' in mixed-demo-seed.ts): this profile only
    // supplies the invoiced/project side (AR/AP). The recurring retainer income and fixed
    // costs that make this business "mixed" are layered on afterward as RecurringObligation /
    // ExpectedSettlement rows against the bank accounts this pack creates.
    slug: 'demo-creative-agency',
    currency: 'USD',
    operatingMask: '****5577',
    reserveMask: '****2288',
    cash: { operating: 58000, reserve: 20000 },
    monthly: { revenue: 85000, payroll: 52000, expenses: 26000 },
    ar: [
      { customer: 'Northgate Retail', invoice: 'CA-3001', invoiceDate: '2026-05-10', dueDate: '2026-06-09', amount: 32000 },
      { customer: 'Summit Media Group', invoice: 'CA-3002', invoiceDate: '2026-05-21', dueDate: '2026-06-20', amount: 21000 },
      { customer: 'Lakeside Ventures', invoice: 'CA-3003', invoiceDate: '2026-05-27', dueDate: '2026-06-26', amount: 14000 },
    ],
    ap: [
      { supplier: 'Freelance Design Pool', bill: 'CA-AP01', billDate: '2026-05-16', dueDate: '2026-06-15', amount: 15000, priority: 'critical' },
      { supplier: 'Payroll Services', bill: 'CA-PAY05', billDate: '2026-05-26', dueDate: '2026-06-05', amount: 26000, priority: 'payroll' },
      { supplier: 'Creative Software Suite', bill: 'CA-AP02', billDate: '2026-05-12', dueDate: '2026-06-11', amount: 3200, priority: 'flexible' },
    ],
    revenueSeasonality: [1.0, 0.98, 1.02, 1.05, 0.97, 1.0, 1.03, 1.01, 0.99, 1.04, 1.02, 0.98, 1.01, 1.0],
  },
];
