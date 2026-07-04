export interface BankAccountView {
  id: string;
  accountName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  accountPurpose: AccountPurpose;
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
  businessMode: BusinessMode;
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

export type ObligationCategory =
  | 'payroll'
  | 'superannuation'
  | 'payg_withholding'
  | 'gst_bas'
  | 'tax'
  | 'rent'
  | 'loan_repayment'
  | 'insurance'
  | 'subscription'
  | 'utilities'
  | 'vehicle'
  | 'merchant_fees'
  | 'other';

export type ObligationFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface RecurringObligationView {
  id: string;
  name: string;
  category: ObligationCategory;
  amount: number;
  frequency: ObligationFrequency;
  nextDueDate: string;
  notes: string | null;
  active: boolean;
  paymentMethod: string | null;
  linkedBankAccountId: string | null;
  confidence: ConfidenceLevel | null;
}

export type BusinessMode = 'invoice_driven' | 'cash_driven' | 'mixed';

export type AccountPurpose =
  | 'operating'
  | 'payroll_reserve'
  | 'tax_reserve'
  | 'ndis_settlement'
  | 'merchant_clearing'
  | 'amex_settlement'
  | 'savings'
  | 'emergency_reserve'
  | 'loan_offset'
  | 'project_funds'
  | 'other';

export type SettlementStatus = 'expected' | 'pending' | 'received' | 'delayed' | 'unknown';

export interface ExpectedSettlementView {
  id: string;
  source: string;
  amount: number;
  frequency: ObligationFrequency;
  nextExpectedDate: string;
  destinationAccountId: string | null;
  status: SettlementStatus;
  confidence: ConfidenceLevel | null;
  notes: string | null;
  active: boolean;
}

export type DataQualityModuleStatus = 'missing' | 'stale' | 'fresh';

export interface DataQualityModuleView {
  status: DataQualityModuleStatus;
  lastUpdated: string | null;
  daysSinceUpdate: number | null;
}

export interface DataQualityReportView {
  score: number;
  modules: {
    bankTransactions: DataQualityModuleView;
    receivables: DataQualityModuleView;
    payables: DataQualityModuleView;
    budgetActuals: DataQualityModuleView;
  };
  warnings: string[];
}

export interface NotificationView {
  id: string;
  type: 'obligation_due_soon' | 'payroll_shortfall' | 'runway_risk';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type NotificationsResponse =
  | { locked: true; unreadCount: number; message: string; preview: Array<{ severity: string; type: string }> }
  | { locked: false; notifications: NotificationView[] };

export type PulseSeverity = 'critical' | 'warning' | 'info';

export type BusinessPulseCategory =
  | 'obligation_due'
  | 'overdue_payable'
  | 'overdue_receivable'
  | 'expected_receipt'
  | 'cash_buffer'
  | 'forecast_shortfall'
  | 'stale_bank_data'
  | 'payroll_risk'
  | 'direct_debit_pressure'
  | 'settlement_delay'
  | 'cash_in_settlement_accounts'
  | 'low_operating_cash';

export interface BusinessPulseItemView {
  id: string;
  severity: PulseSeverity;
  category: BusinessPulseCategory;
  linkPath: string;
  name: string;
  amount: number;
  currency: string;
  dueDate?: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  runwayWeeks?: number;
  isPayrollPriority?: boolean;
  weekIndex?: number;
  daysSinceUpdate?: number;
}

export interface BusinessPulseReportView {
  asOfDate: string;
  items: BusinessPulseItemView[];
  briefing: string;
  briefingModel: string;
  briefingSource: 'openai' | 'rule_based';
}

export type DecisionType = 'hire' | 'buy_equipment' | 'withdraw_funds' | 'repay_debt' | 'expand' | 'custom';

export interface DecisionCentreRequest {
  type: DecisionType;
  amount?: number;
  percent?: number;
  customQuestion?: string;
  locale?: string;
}

export interface DecisionScenarioSummaryView {
  baseline: { week13ClosingCash: number | null; runwayWeeks: number | null };
  scenario: { week13ClosingCash: number | null; runwayWeeks: number | null };
  delta: { week13ClosingCash: number | null; runwayWeeks: number | null };
}

export interface DecisionCentreResponseView {
  question: string;
  scenario: DecisionScenarioSummaryView | null;
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

export type ConfidenceRating = 'high' | 'medium' | 'low';

export interface ConfidenceWeaknessView {
  problem: string;
  businessImpact: string;
  fix: string;
}

export interface ConfidenceReportView {
  score: number;
  rating: ConfidenceRating;
  strengths: string[];
  weaknesses: ConfidenceWeaknessView[];
  recommendedNextAction: string;
}

export interface MaterialMovementView {
  label: string;
  current: number;
  previous: number;
  delta: number;
  percentChange: number | null;
  currentPeriod: string;
  previousPeriod: string;
}

export interface WhyChangedResponseView {
  hasHistory: boolean;
  movements: MaterialMovementView[];
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

export type PayrollReadinessStatus = 'comfortable' | 'covered' | 'shortfall';

export interface PayrollReadinessView {
  nextPayrollDate: string | null;
  expectedPayrollAmount: number;
  availablePayrollCash: number;
  bufferAfterPayroll: number;
  status: PayrollReadinessStatus | null;
}

export interface UpcomingObligationOccurrenceView {
  obligationId: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  nextDueDate: string;
  paymentMethod: string | null;
  linkedBankAccount: string | null;
  confidence: ConfidenceLevel | null;
}

export interface SettlementOccurrenceView {
  settlementId: string;
  source: string;
  expectedAmount: number;
  expectedDate: string;
  destinationAccount: string | null;
  status: SettlementStatus;
  confidence: ConfidenceLevel | null;
}

export interface WeeklyCashMovementView {
  weekIndex: number;
  weekStartDate: string;
  openingCash: number;
  expectedIncoming: number;
  expectedOutgoing: number;
  closingCash: number;
  netMovement: number;
}

export interface CashByPurposeView {
  totalCash: number;
  currency: string;
  payrollReserve: number;
  taxReserve: number;
  emergencyReserve: number;
  restrictedOrClearingFunds: number;
  otherReserved: number;
  knownUpcomingObligations: number;
  availableToSpend: number;
  byPurpose: Record<AccountPurpose, number>;
}

export interface CashDrivenDashboardView {
  payrollReadiness: PayrollReadinessView;
  upcomingObligations: UpcomingObligationOccurrenceView[];
  settlementTimeline: SettlementOccurrenceView[];
  weeklyCashMovement: WeeklyCashMovementView[];
  cashByPurpose: CashByPurposeView;
}
