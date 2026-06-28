import type { UploadValidationError } from '@liqvia2/shared';
import type { Locale } from '@/lib/i18n';

/** Localize shared upload validation messages for display in the UI. */
export function translateUploadValidationMessage(message: string, locale: Locale): string {
  if (locale === 'en') return message;

  if (locale === 'ru') {
    let m = message;

    m = m.replace(
      /^Expected (\d+) columns \((.+)\) but found (\d+)$/,
      'Ожидалось $1 столбцов ($2), найдено $3',
    );
    m = m.replace(
      /^Column (\d+) must be "(.+)" \(found "(.*)"\)$/,
      'Столбец $1 должен быть «$2» (найдено «$3»)',
    );
    m = m.replace(
      /^Currency must match company currency \((.+)\)$/,
      'Валюта должна совпадать с валютой компании ($1)',
    );
    m = m.replace(/^Duplicate (.+) in file$/, 'Дубликат ($1) в файле');
    m = m.replace(
      /^File exceeds maximum upload size \((\d+) characters\)$/,
      'Файл превышает максимальный размер загрузки ($1 символов)',
    );
    m = m.replace(/^File is empty$/, 'Файл пуст');
    m = m.replace(/^File must contain at least one data row$/, 'Файл должен содержать хотя бы одну строку данных');
    m = m.replace(
      /^File exceeds maximum of (\d+) data rows$/,
      'Файл превышает максимум $1 строк данных',
    );
    m = m.replace(
      /^Date must fall within the past 14 weeks \((.+)\)$/,
      'Дата должна попадать в прошлые 14 недель ($1)',
    );
    m = m.replace(
      /^Period (.+) must fall within the next 13 weeks \((.+)\)$/,
      'Период $1 должен попадать в следующие 13 недель ($2)',
    );
    m = m.replace(/^Due Date must be on or after Invoice Date$/, 'Срок оплаты должен быть не раньше даты счёта');
    m = m.replace(/^Due Date must be on or after Bill Date$/, 'Срок оплаты должен быть не раньше даты накладной');
    m = m.replace(/^Debit and Credit cannot both be zero$/, 'Дебет и кредит не могут быть одновременно нулевыми');
    m = m.replace(
      /^Supplier Priority must be payroll, tax, critical, flexible, or non-essential$/,
      'Приоритет поставщика: payroll, tax, critical, flexible или non-essential',
    );
    m = m.replace(
      /^Category must be revenue, payroll, expenses, capex, or loan_repayment$/,
      'Категория: revenue, payroll, expenses, capex или loan_repayment',
    );
    m = m.replace(/^Direction must be IN or OUT$/, 'Направление должно быть IN или OUT');
    m = m.replace(/^Validation failed$/, 'Ошибка валидации');

    return m;
  }

  return message;
}

export function translateUploadValidationErrors(
  errors: UploadValidationError[],
  locale: Locale,
): UploadValidationError[] {
  return errors.map((err) => ({
    ...err,
    message: translateUploadValidationMessage(err.message, locale),
  }));
}
