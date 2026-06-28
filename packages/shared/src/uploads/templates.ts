import type { UploadTemplateType } from './types';

export interface UploadTemplateDefinition {
  type: UploadTemplateType;
  label: string;
  headers: readonly string[];
  sampleFileName: string;
}

export const UPLOAD_TEMPLATES: Record<UploadTemplateType, UploadTemplateDefinition> = {
  trial_balance: {
    type: 'trial_balance',
    label: 'Trial Balance',
    headers: ['Period', 'Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit'],
    sampleFileName: 'trial-balance-sample.csv',
  },
  ar_ageing: {
    type: 'ar_ageing',
    label: 'AR Ageing',
    headers: [
      'Customer Name',
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Outstanding Amount',
      'Currency',
    ],
    sampleFileName: 'ar-ageing-sample.csv',
  },
  ap_ageing: {
    type: 'ap_ageing',
    label: 'AP Ageing',
    headers: [
      'Supplier Name',
      'Bill Number',
      'Bill Date',
      'Due Date',
      'Outstanding Amount',
      'Supplier Priority',
      'Currency',
    ],
    sampleFileName: 'ap-ageing-sample.csv',
  },
  bank_balances: {
    type: 'bank_balances',
    label: 'Bank Balances',
    headers: [
      'Bank Account Name',
      'Account Number Masked',
      'Currency',
      'Balance Date',
      'Current Balance',
    ],
    sampleFileName: 'bank-balances-sample.csv',
  },
  bank_transactions: {
    type: 'bank_transactions',
    label: 'Bank Transactions',
    headers: [
      'Bank Account Name',
      'Account Number Masked',
      'Transaction Date',
      'Description',
      'Amount',
      'Direction',
    ],
    sampleFileName: 'bank-transactions-sample.csv',
  },
  prior_period_budget: {
    type: 'prior_period_budget',
    label: 'Prior Period Budget (14 weeks)',
    headers: ['Period', 'Category', 'Account Code', 'Budget Amount'],
    sampleFileName: 'prior-period-budget-sample.csv',
  },
  rolling_budget: {
    type: 'rolling_budget',
    label: 'Rolling Budget (13 weeks, optional)',
    headers: ['Period', 'Category', 'Account Code', 'Budget Amount'],
    sampleFileName: 'rolling-budget-sample.csv',
  },
  budget: {
    type: 'budget',
    label: 'Prior Period Budget (legacy)',
    headers: ['Period', 'Category', 'Account Code', 'Budget Amount', 'Budget Type'],
    sampleFileName: 'budget-sample.csv',
  },
  weekly_actuals: {
    type: 'weekly_actuals',
    label: 'Weekly Actuals (14 weeks)',
    headers: ['Period', 'Category', 'Account Code', 'Actual Amount'],
    sampleFileName: 'weekly-actuals-sample.csv',
  },
  expense_report: {
    type: 'expense_report',
    label: 'Expense Report / Statement',
    headers: ['Transaction Date', 'Payee', 'Description', 'Category', 'Amount', 'Currency'],
    sampleFileName: 'expense-report-sample.csv',
  },
};

export const UPLOAD_TEMPLATE_TYPES = Object.keys(UPLOAD_TEMPLATES) as UploadTemplateType[];
