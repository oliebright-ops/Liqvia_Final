export interface LedgerEntry {
  id: string;
  type: 'receivable' | 'payable';
  counterparty: string;
  documentNumber: string;
  documentDate: string;
  dueDate: string;
  outstandingAmount: number;
  currency: string;
  daysPastDue: number;
  agingBucket: string;
  status: 'open' | 'overdue';
  supplierPriority?: string;
}

export interface AgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface LedgerPayload {
  companyId: string;
  currency: string;
  asOfDate: string;
  receivables: LedgerEntry[];
  payables: LedgerEntry[];
  arAging: AgingBucket[];
  apAging: AgingBucket[];
  totals: {
    arOutstanding: number;
    apOutstanding: number;
    arOverdue: number;
    apOverdue: number;
  };
}
