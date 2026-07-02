export interface BankAccountView {
  id: string;
  accountName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  status: 'active' | 'inactive';
}

export interface BankAccountsSummary {
  accounts: BankAccountView[];
  aggregateBalance: number;
  aggregateOpeningBalance: number;
  currency: string;
  accountCount: number;
}

export interface BankTransactionView {
  id: string;
  transactionDate: string;
  description: string;
  category: string;
  amount: number;
  direction: 'IN' | 'OUT';
  runningBalance: number;
  status: 'cleared' | 'pending';
  /** Heuristic amount/date match against open AR/AP — not a certified reconciliation. */
  reconciliationStatus: 'matched' | 'partial' | 'unmatched';
  matchedCounterparty?: string;
}

export interface BankAccountLedgerView {
  openingBalance: number;
  openingDate: string | null;
  closingBalance: number;
  transactions: BankTransactionView[];
  reconciliationSummary: {
    matched: number;
    partial: number;
    unmatched: number;
    unmatchedInflowTotal: number;
    unmatchedOutflowTotal: number;
  };
}

export interface CompanySettings {
  id: string;
  name: string;
  industry: string | null;
  currency: string;
  locale: string;
  fiscalYearStart: number;
  forecastHorizonWeeks: number;
  forecastLookbackWeeks: number;
  reportingPeriod: string | null;
  periodGranularity: 'monthly' | 'weekly';
  openingCashBalance: number | null;
  onboardingCompleted: boolean;
}

export interface TeamMemberView {
  id: string;
  email: string;
  role: string;
  userId: string | null;
  name: string;
  status: 'active' | 'pending';
  createdAt: string;
}

export interface ChartOfAccountView {
  id: string;
  code: string;
  name: string;
  accountType: string;
  status: 'active' | 'archived';
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  reply: string;
  messages: AiChatMessage[];
  model: string;
  source: 'openai' | 'rule_based';
}
