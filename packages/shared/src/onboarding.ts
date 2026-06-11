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

export const SETUP_STEPS: OnboardingPhase[] = [
  'company',
  'team',
  'upload',
  'preview',
  'done',
];

export const ONBOARDING_STEPS = SETUP_STEPS;

export const DEMO_COMPANY_ID = 'demo-consulting';

export interface OnboardingCompanyInput {
  name: string;
  industry: string;
  currency: string;
  fiscalYearStart: number;
  forecastHorizonWeeks: number;
  openingCashBalance: number;
  locale?: string;
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
  role: 'member' | 'viewer' | 'admin';
}

export interface OnboardingCreateCompanyPayload {
  company: OnboardingCompanyInput;
  teamMembers?: OnboardingTeamMemberInput[];
}
