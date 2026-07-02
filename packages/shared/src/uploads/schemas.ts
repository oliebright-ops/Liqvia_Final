import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD');

const currencyCode = z
  .string()
  .length(3, 'Currency must be a 3-letter ISO 4217 code')
  .transform((v) => v.toUpperCase());

const positiveAmount = z.coerce
  .number({ invalid_type_error: 'Must be a number' })
  .positive('Must be greater than 0');

const nonNegativeAmount = z.coerce
  .number({ invalid_type_error: 'Must be a number' })
  .min(0, 'Must be 0 or greater');

const periodMonth = z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM');
const periodFlexible = z
  .string()
  .regex(/^\d{4}-(\d{2}|W\d{2})$/, 'Period must be YYYY-MM or YYYY-W##');

const accountType = z
  .string()
  .transform((v) => v.toLowerCase())
  .pipe(
    z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'], {
      errorMap: () => ({
        message: 'Account Type must be asset, liability, equity, revenue, or expense',
      }),
    }),
  );

const supplierPriority = z
  .string()
  .transform((v) => v.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'))
  .pipe(
    z.enum(['payroll', 'tax', 'critical', 'flexible', 'non_essential'], {
      errorMap: () => ({
        message: 'Supplier Priority must be payroll, tax, critical, flexible, or non-essential',
      }),
    }),
  );

const budgetCategory = z
  .string()
  .transform((v) => v.toLowerCase())
  .pipe(
    z.enum(['revenue', 'payroll', 'expenses', 'capex', 'loan_repayment'], {
      errorMap: () => ({
        message: 'Category must be revenue, payroll, expenses, capex, or loan_repayment',
      }),
    }),
  );

export const trialBalanceRowSchema = z
  .object({
    Period: periodMonth,
    'Account Code': z.string().min(1, 'Account Code is required'),
    'Account Name': z.string().min(1, 'Account Name is required'),
    'Account Type': accountType,
    Debit: nonNegativeAmount,
    Credit: nonNegativeAmount,
  })
  .superRefine((row, ctx) => {
    if (row.Debit === 0 && row.Credit === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debit and Credit cannot both be zero',
      });
    }
  });

export const arAgeingRowSchema = z
  .object({
    'Customer Name': z.string().min(1, 'Customer Name is required'),
    'Invoice Number': z.string().min(1, 'Invoice Number is required'),
    'Invoice Date': isoDate,
    'Due Date': isoDate,
    'Outstanding Amount': positiveAmount,
    Currency: currencyCode,
  })
  .superRefine((row, ctx) => {
    if (row['Due Date'] < row['Invoice Date']) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Due Date must be on or after Invoice Date',
        path: ['Due Date'],
      });
    }
  });

export const apAgeingRowSchema = z
  .object({
    'Supplier Name': z.string().min(1, 'Supplier Name is required'),
    'Bill Number': z.string().min(1, 'Bill Number is required'),
    'Bill Date': isoDate,
    'Due Date': isoDate,
    'Outstanding Amount': positiveAmount,
    'Supplier Priority': supplierPriority,
    Currency: currencyCode,
  })
  .superRefine((row, ctx) => {
    if (row['Due Date'] < row['Bill Date']) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Due Date must be on or after Bill Date',
        path: ['Due Date'],
      });
    }
  });

export const bankBalancesRowSchema = z.object({
  'Bank Account Name': z.string().min(1, 'Bank Account Name is required'),
  'Account Number Masked': z.string().min(4, 'Account Number Masked is required (last 4 digits)'),
  Currency: currencyCode,
  'Balance Date': isoDate,
  'Current Balance': z.coerce.number({ invalid_type_error: 'Must be a number' }),
});

const transactionDirection = z
  .string()
  .transform((v) => v.toUpperCase().trim())
  .pipe(z.enum(['IN', 'OUT'], { message: 'Direction must be IN or OUT' }));

export const bankTransactionsRowSchema = z.object({
  'Bank Account Name': z.string().min(1, 'Bank Account Name is required'),
  'Account Number Masked': z.string().min(4, 'Account Number Masked is required (last 4 digits)'),
  'Transaction Date': isoDate,
  Description: z.string().min(1, 'Description is required'),
  Amount: positiveAmount,
  Direction: transactionDirection,
});

const isoWeekPeriod = z.string().regex(/^\d{4}-W\d{2}$/, 'Period must be YYYY-W##');

const budgetAmount = z.coerce
  .number({ invalid_type_error: 'Must be a number' })
  .refine((n) => !Number.isNaN(n), 'Budget Amount is required');

export const priorPeriodBudgetRowSchema = z.object({
  Period: isoWeekPeriod,
  Category: budgetCategory,
  'Account Code': z.string().optional().default(''),
  'Budget Amount': budgetAmount,
});

export const rollingBudgetRowSchema = priorPeriodBudgetRowSchema;

export const budgetRowSchema = priorPeriodBudgetRowSchema.extend({
  'Budget Type': z.string().min(1, 'Budget Type is required'),
});

export const weeklyActualsRowSchema = z.object({
  Period: isoWeekPeriod,
  Category: budgetCategory,
  'Account Code': z.string().optional().default(''),
  'Actual Amount': z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .refine((n) => !Number.isNaN(n), 'Actual Amount is required'),
});

export type TrialBalanceRow = z.infer<typeof trialBalanceRowSchema>;
export type ArAgeingRow = z.infer<typeof arAgeingRowSchema>;
export type ApAgeingRow = z.infer<typeof apAgeingRowSchema>;
export type BankBalancesRow = z.infer<typeof bankBalancesRowSchema>;
export type BankTransactionsRow = z.infer<typeof bankTransactionsRowSchema>;
export type PriorPeriodBudgetRow = z.infer<typeof priorPeriodBudgetRowSchema>;
export type RollingBudgetRow = z.infer<typeof rollingBudgetRowSchema>;
export type BudgetRow = z.infer<typeof budgetRowSchema>;
export type WeeklyActualsRow = z.infer<typeof weeklyActualsRowSchema>;
