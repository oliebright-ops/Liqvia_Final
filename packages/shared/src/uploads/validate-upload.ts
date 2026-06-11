import { parseCsv } from '../csv/parse-csv';
import { getFutureWeekPeriods, getPastWeekPeriods } from '../rolling-budget';
import type { UploadTemplateType, UploadValidationError } from './types';
import { UPLOAD_TEMPLATES } from './templates';
import {
  apAgeingRowSchema,
  arAgeingRowSchema,
  bankBalancesRowSchema,
  bankTransactionsRowSchema,
  budgetRowSchema,
  priorPeriodBudgetRowSchema,
  rollingBudgetRowSchema,
  trialBalanceRowSchema,
  weeklyActualsRowSchema,
} from './schemas';
import type { z } from 'zod';

export interface UploadValidationResult<T = unknown> {
  valid: boolean;
  templateType: UploadTemplateType;
  rowCount: number;
  errors: UploadValidationError[];
  rows?: T[];
}

export interface ValidateUploadOptions {
  /** When set, currency on each row must match (AR/AP/Bank). */
  companyCurrency?: string;
  /** Reference date for rolling 14-week window validation. */
  asOfDate?: string;
}

const rowSchemas: Record<UploadTemplateType, z.ZodTypeAny> = {
  trial_balance: trialBalanceRowSchema,
  ar_ageing: arAgeingRowSchema,
  ap_ageing: apAgeingRowSchema,
  bank_balances: bankBalancesRowSchema,
  bank_transactions: bankTransactionsRowSchema,
  budget: budgetRowSchema,
  prior_period_budget: priorPeriodBudgetRowSchema,
  rolling_budget: rollingBudgetRowSchema,
  weekly_actuals: weeklyActualsRowSchema,
};

function buildValidationFailure<T>(
  templateType: UploadTemplateType,
  errors: UploadValidationError[],
  rowCount = 0,
): UploadValidationResult<T> {
  return {
    valid: false,
    templateType,
    rowCount,
    errors,
  };
}

function validateHeaders(actual: string[], expected: readonly string[]): UploadValidationError[] {
  const errors: UploadValidationError[] = [];
  if (actual.length !== expected.length) {
    errors.push({
      message: `Expected ${expected.length} columns (${expected.join(', ')}) but found ${actual.length}`,
    });
    return errors;
  }
  expected.forEach((col, i) => {
    if (actual[i] !== col) {
      errors.push({
        row: 1,
        column: actual[i],
        message: `Column ${i + 1} must be "${col}" (found "${actual[i] ?? ''}")`,
      });
    }
  });
  return errors;
}

function validateRowCurrency(
  templateType: UploadTemplateType,
  data: Record<string, unknown>,
  companyCurrency: string | undefined,
  rowNumber: number,
): UploadValidationError | null {
  if (!companyCurrency) return null;
  const currencyTemplates: UploadTemplateType[] = ['ar_ageing', 'ap_ageing', 'bank_balances'];
  if (!currencyTemplates.includes(templateType)) return null;
  const rowCurrency = String(data.Currency ?? '').toUpperCase();
  if (rowCurrency !== companyCurrency.toUpperCase()) {
    return {
      row: rowNumber,
      column: 'Currency',
      message: `Currency must match company currency (${companyCurrency})`,
    };
  }
  return null;
}

function checkDuplicate(
  templateType: UploadTemplateType,
  data: Record<string, unknown>,
  seen: Set<string>,
  rowNumber: number,
): UploadValidationError | null {
  let key: string | null = null;
  let label = '';

  switch (templateType) {
    case 'trial_balance':
      key = `${data.Period}|${data['Account Code']}`;
      label = 'Period + Account Code';
      break;
    case 'ar_ageing':
      key = String(data['Invoice Number']);
      label = 'Invoice Number';
      break;
    case 'ap_ageing':
      key = String(data['Bill Number']);
      label = 'Bill Number';
      break;
    case 'bank_balances':
      key = `${data['Bank Account Name']}|${data['Balance Date']}`;
      label = 'Bank Account Name + Balance Date';
      break;
    case 'bank_transactions':
      key = `${data['Bank Account Name']}|${data['Account Number Masked']}|${data['Transaction Date']}|${data.Description}|${data.Amount}|${data.Direction}`;
      label = 'Bank Account + Transaction Date + Description + Amount + Direction';
      break;
    case 'budget':
    case 'prior_period_budget':
    case 'rolling_budget':
    case 'weekly_actuals':
      key = `${data.Period}|${data.Category}|${data['Account Code'] ?? ''}`;
      label = 'Period + Category + Account Code';
      break;
    default:
      return null;
  }

  if (seen.has(key)) {
    return { row: rowNumber, message: `Duplicate ${label} in file` };
  }
  seen.add(key);
  return null;
}

export function validateUpload<T = unknown>(
  templateType: UploadTemplateType,
  csvContent: string,
  options: ValidateUploadOptions = {},
): UploadValidationResult<T> {
  const template = UPLOAD_TEMPLATES[templateType];
  const errors: UploadValidationError[] = [];
  const parsed = parseCsv(csvContent);

  if (parsed.headers.length === 0) {
    return buildValidationFailure(templateType, [{ message: 'File is empty' }]);
  }

  const headerErrors = validateHeaders(parsed.headers, [...template.headers]);
  errors.push(...headerErrors);

  if (parsed.rows.length === 0) {
    errors.push({ message: 'File must contain at least one data row' });
  }

  if (errors.length > 0) {
    return buildValidationFailure(templateType, errors);
  }

  const schema = rowSchemas[templateType];
  const validRows: T[] = [];
  const seenKeys = new Set<string>();

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const emptyRow = Object.values(row).every((v) => v === '');
    if (emptyRow) return;

    const result = schema.safeParse(row);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const column = issue.path[0]?.toString();
        errors.push({
          row: rowNumber,
          column,
          message: issue.message,
        });
      }
      return;
    }

    const data = result.data as Record<string, unknown>;
    const currencyError = validateRowCurrency(
      templateType,
      data,
      options.companyCurrency,
      rowNumber,
    );
    if (currencyError) {
      errors.push(currencyError);
      return;
    }

    const duplicateError = checkDuplicate(templateType, data, seenKeys, rowNumber);
    if (duplicateError) {
      errors.push(duplicateError);
      return;
    }

    validRows.push(result.data as T);
  });

  if (validRows.length === 0 && errors.length === 0) {
    errors.push({ message: 'File must contain at least one data row' });
  }

  if (validRows.length > 0 && errors.length === 0) {
    const asOfDate = options.asOfDate ?? new Date().toISOString().slice(0, 10);

    if (
      templateType === 'weekly_actuals' ||
      templateType === 'prior_period_budget' ||
      templateType === 'budget'
    ) {
      const allowed = new Set(getPastWeekPeriods(asOfDate));
      validRows.forEach((row, index) => {
        const period = String((row as Record<string, unknown>).Period);
        if (!allowed.has(period)) {
          errors.push({
            row: index + 2,
            column: 'Period',
            message: `Period ${period} must fall within the past 14 weeks (${[...allowed].slice(0, 2).join(', ')} … ${[...allowed].at(-1)})`,
          });
        }
      });
    }

    if (templateType === 'rolling_budget') {
      const allowed = new Set(getFutureWeekPeriods(asOfDate));
      validRows.forEach((row, index) => {
        const period = String((row as Record<string, unknown>).Period);
        if (!allowed.has(period)) {
          errors.push({
            row: index + 2,
            column: 'Period',
            message: `Period ${period} must fall within the next 13 weeks (${[...allowed].slice(0, 2).join(', ')} … ${[...allowed].at(-1)})`,
          });
        }
      });
    }
  }

  if (errors.length > 0) {
    return buildValidationFailure(templateType, errors, validRows.length);
  }

  return {
    valid: true,
    templateType,
    rowCount: validRows.length,
    errors: [],
    rows: validRows,
  };
}
