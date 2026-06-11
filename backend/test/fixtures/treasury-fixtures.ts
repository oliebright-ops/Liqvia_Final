import { ForecastCalculationInput } from '@liqvia2/shared';

/** Reusable deterministic fixtures mirroring the demo company profiles. */
export const healthyCompanyInput: ForecastCalculationInput = {
  asOfDate: '2026-06-01',
  openingCash: 225000,
  receivables: [
    { outstandingAmount: 42000, invoiceDate: '2026-05-15' },
    { outstandingAmount: 28000, invoiceDate: '2026-05-20' },
    { outstandingAmount: 18000, invoiceDate: '2026-05-28' },
  ],
  payables: [
    { outstandingAmount: 34000, dueDate: '2026-06-05', supplierPriority: 'payroll' },
    { outstandingAmount: 4200, dueDate: '2026-06-17', supplierPriority: 'critical' },
    { outstandingAmount: 1500, dueDate: '2026-06-21', supplierPriority: 'flexible' },
  ],
};

export const criticalCompanyInput: ForecastCalculationInput = {
  asOfDate: '2026-06-01',
  openingCash: 38000,
  receivables: [
    { outstandingAmount: 16000, invoiceDate: '2026-05-25' },
    { outstandingAmount: 6000, invoiceDate: '2026-05-28' },
  ],
  payables: [
    { outstandingAmount: 78000, dueDate: '2026-06-06', supplierPriority: 'payroll' },
    { outstandingAmount: 18000, dueDate: '2026-06-14', supplierPriority: 'critical' },
    { outstandingAmount: 12000, dueDate: '2026-06-19', supplierPriority: 'flexible' },
  ],
};

export const overdueReceivables = [
  { outstandingAmount: 26000, invoiceDate: '2026-03-10', dueDate: '2026-04-09' },
  { outstandingAmount: 14000, invoiceDate: '2026-05-22', dueDate: '2026-06-21' },
];

export const upcomingPayables = [
  { outstandingAmount: 68000, billDate: '2026-05-25', dueDate: '2026-06-06' },
  { outstandingAmount: 6000, billDate: '2026-05-20', dueDate: '2026-06-19' },
];
