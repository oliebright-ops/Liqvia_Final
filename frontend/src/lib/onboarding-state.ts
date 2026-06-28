import { FISCAL_MONTHS, createDefaultBankAccountRow, OnboardingCompanyInput, OnboardingTeamMemberInput } from '@liqvia2/shared';

export interface OnboardingWizardState {
  company: OnboardingCompanyInput;
  teamMembers: OnboardingTeamMemberInput[];
}

export function createInitialOnboardingState(): OnboardingWizardState {
  return {
    company: {
      name: '',
      industry: 'Construction',
      currency: 'GBP',
      fiscalYearStart: 1,
      forecastHorizonWeeks: 13,
      openingCashBalance: 0,
      locale: 'en',
      bankAccounts: [createDefaultBankAccountRow('GBP')],
    },
    teamMembers: [],
  };
}

export function fiscalMonthLabel(month: number): string {
  return FISCAL_MONTHS.find((m) => m.value === month)?.label ?? String(month);
}
