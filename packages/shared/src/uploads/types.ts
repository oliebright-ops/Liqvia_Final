export type UploadTemplateType =
  | 'trial_balance'
  | 'ar_ageing'
  | 'ap_ageing'
  | 'bank_balances'
  | 'bank_transactions'
  | 'budget'
  | 'prior_period_budget'
  | 'rolling_budget'
  | 'weekly_actuals'
  | 'expense_report';

export type SupplierPriority = 'payroll' | 'tax' | 'critical' | 'flexible' | 'non_essential';

export interface UploadValidationError {
  row?: number;
  column?: string;
  message: string;
}
