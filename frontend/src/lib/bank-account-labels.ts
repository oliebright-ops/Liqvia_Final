import { TranslateFn } from './i18n';

const ACCOUNT_NAME_KEYS: Record<string, string> = {
  'primary operating account': 'modules.bankAccounts.accountNames.primaryOperating',
  'operating account': 'modules.bankAccounts.accountNames.operating',
  'salary account': 'modules.bankAccounts.accountNames.salary',
  'payroll account': 'modules.bankAccounts.accountNames.payroll',
  'tax account': 'modules.bankAccounts.accountNames.tax',
  'reserve account': 'modules.bankAccounts.accountNames.reserve',
};

export function translateBankAccountName(name: string, format: TranslateFn): string {
  const key = ACCOUNT_NAME_KEYS[name.toLowerCase().trim()];
  if (!key) return name;
  const translated = format(key);
  return translated === key ? name : translated;
}
