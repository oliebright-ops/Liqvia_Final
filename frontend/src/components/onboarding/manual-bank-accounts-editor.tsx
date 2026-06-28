'use client';

import {
  CURRENCIES,
  createDefaultBankAccountRow,
  OnboardingBankAccountInput,
  sumBankAccountOpeningBalances,
} from '@liqvia2/shared';
import { formatCurrency } from '@liqvia2/shared';
import { useTranslations } from '@/lib/i18n';

const onboardingInputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const settingsInputClass =
  'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

type Variant = 'onboarding' | 'settings';

export function ManualBankAccountsEditor({
  accounts,
  onChange,
  defaultCurrency,
  variant = 'onboarding',
}: {
  accounts: OnboardingBankAccountInput[];
  onChange: (accounts: OnboardingBankAccountInput[]) => void;
  defaultCurrency: string;
  variant?: Variant;
}) {
  const t = useTranslations();
  const inputClass = variant === 'onboarding' ? onboardingInputClass : settingsInputClass;
  const rows = accounts.length > 0 ? accounts : [createDefaultBankAccountRow(defaultCurrency)];
  const total = sumBankAccountOpeningBalances(rows);

  function updateRow(index: number, patch: Partial<OnboardingBankAccountInput>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function addRow() {
    onChange([...rows, createDefaultBankAccountRow(defaultCurrency)]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      onChange([createDefaultBankAccountRow(defaultCurrency)]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t('onboarding.company.bankAccountsTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.company.bankAccountsHint')}</p>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className={
              variant === 'onboarding'
                ? 'rounded-lg border border-slate-700 bg-slate-800/40 p-4'
                : 'rounded-lg border border-border bg-muted/20 p-4'
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted-foreground sm:col-span-2">
                {t('onboarding.company.bankAccountName')}
                <input
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder={t('onboarding.company.bankAccountNamePlaceholder')}
                  className={inputClass}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                {t('onboarding.company.bankAccountMasked')}
                <input
                  value={row.accountNumberMasked}
                  onChange={(e) => updateRow(index, { accountNumberMasked: e.target.value })}
                  placeholder="****1234"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                {t('onboarding.company.bankAccountCurrency')}
                <select
                  value={row.currency ?? defaultCurrency}
                  onChange={(e) => updateRow(index, { currency: e.target.value })}
                  className={inputClass}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground sm:col-span-2">
                {t('onboarding.company.bankAccountBalance')} ({row.currency ?? defaultCurrency})
                <input
                  type="number"
                  step="any"
                  value={row.openingBalance || ''}
                  onChange={(e) =>
                    updateRow(index, {
                      openingBalance: e.target.value === '' ? 0 : Number(e.target.value),
                    })
                  }
                  placeholder="0"
                  className={inputClass}
                />
              </label>
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="mt-3 text-xs text-red-400 hover:text-red-300"
              >
                {t('onboarding.company.bankAccountRemove')}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className={
            variant === 'onboarding'
              ? 'rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500'
              : 'rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40'
          }
        >
          {t('onboarding.company.bankAccountAdd')}
        </button>
        <p className="text-xs text-muted-foreground">
          {t('onboarding.company.bankAccountsTotal')}:{' '}
          <span className="font-mono font-medium text-foreground">
            {formatCurrency(total, defaultCurrency)}
          </span>
        </p>
      </div>
    </div>
  );
}
