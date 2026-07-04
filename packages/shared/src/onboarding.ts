export const INDUSTRIES = [
  'Construction',
  'Professional Services',
  'Retail',
  'Manufacturing',
  'Technology',
  'Healthcare',
  'Other',
] as const;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'RUB'] as const;

export const FISCAL_MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

export const FORECAST_HORIZONS = [13, 26] as const;

export type BusinessMode = 'invoice_driven' | 'cash_driven' | 'mixed';

export const BUSINESS_MODES: Array<{ value: BusinessMode; label: string }> = [
  {
    value: 'invoice_driven',
    label: 'Invoice-based business — We issue invoices and track receivables/payables.',
  },
  {
    value: 'cash_driven',
    label:
      'Cash-driven business — We mainly rely on recurring income, settlements, payroll, and direct debits.',
  },
  {
    value: 'mixed',
    label: 'Mixed business — We use both invoices and recurring/settlement-based cash flows.',
  },
];

export type OnboardingPhase =
  | 'welcome'
  | 'select'
  | 'company'
  | 'team'
  | 'upload'
  | 'preview'
  | 'done';

/** @deprecated Use OnboardingPhase */
export type OnboardingStep = OnboardingPhase;

export const SETUP_STEPS: OnboardingPhase[] = ['company', 'team', 'upload', 'preview', 'done'];

export const ONBOARDING_STEPS = SETUP_STEPS;

export const DEMO_COMPANY_ID = 'demo-consulting';

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

export const ACCOUNT_PURPOSES: AccountPurpose[] = [
  'operating',
  'payroll_reserve',
  'tax_reserve',
  'ndis_settlement',
  'merchant_clearing',
  'amex_settlement',
  'savings',
  'emergency_reserve',
  'loan_offset',
  'project_funds',
  'other',
];

export interface OnboardingBankAccountInput {
  name: string;
  accountNumberMasked: string;
  /** Defaults to company base currency when omitted. */
  currency?: string;
  openingBalance: number;
}

export interface OnboardingCompanyInput {
  name: string;
  industry: string;
  currency: string;
  fiscalYearStart: number;
  forecastHorizonWeeks: number;
  /** Total opening cash — derived from bankAccounts when provided. */
  openingCashBalance: number;
  locale?: string;
  bankAccounts?: OnboardingBankAccountInput[];
  businessMode?: BusinessMode;
}

export function createDefaultBankAccountRow(currency?: string): OnboardingBankAccountInput {
  return {
    name: 'Operating Account',
    accountNumberMasked: '****0001',
    currency,
    openingBalance: 0,
  };
}

export function sumBankAccountOpeningBalances(accounts: OnboardingBankAccountInput[]): number {
  return accounts.reduce((total, account) => total + (Number(account.openingBalance) || 0), 0);
}

export interface OnboardingAdminInput {
  name: string;
  email: string;
  password: string;
}

export interface OnboardingTeamMemberInput {
  name: string;
  email: string;
  password?: string;
  role: 'member' | 'viewer' | 'admin' | 'uploader';
}

export interface OnboardingCreateCompanyPayload {
  company: OnboardingCompanyInput;
  teamMembers?: OnboardingTeamMemberInput[];
}
