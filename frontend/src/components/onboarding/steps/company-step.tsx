'use client';

import {
  CURRENCIES,
  FISCAL_MONTHS,
  FORECAST_HORIZONS,
  INDUSTRIES,
  OnboardingCompanyInput,
} from '@liqvia2/shared';
import { useTranslations } from '@/lib/i18n';
import { OnboardingNav } from '../onboarding-nav';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm text-slate-300';

export function CompanyStep({
  value,
  onChange,
  onNext,
}: {
  value: OnboardingCompanyInput;
  onChange: (next: OnboardingCompanyInput) => void;
  onNext: () => void;
}) {
  const t = useTranslations();

  const canProceed = value.name.trim().length > 0;

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">{t('onboarding.company.title')}</h2>
      <div className="mt-6 space-y-4">
        <label className={labelClass}>
          {t('onboarding.company.name')} *
          <input
            required
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder={t('onboarding.company.namePlaceholder')}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          {t('onboarding.company.industry')}
          <select
            value={value.industry}
            onChange={(e) => onChange({ ...value, industry: e.target.value })}
            className={inputClass}
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t('onboarding.company.currency')}
            <select
              value={value.currency}
              onChange={(e) => onChange({ ...value, currency: e.target.value })}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            {t('onboarding.company.fiscalYear')}
            <select
              value={value.fiscalYearStart}
              onChange={(e) => onChange({ ...value, fiscalYearStart: Number(e.target.value) })}
              className={inputClass}
            >
              {FISCAL_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t('onboarding.company.forecastHorizon')}
            <select
              value={value.forecastHorizonWeeks}
              onChange={(e) => onChange({ ...value, forecastHorizonWeeks: Number(e.target.value) })}
              className={inputClass}
            >
              {FORECAST_HORIZONS.map((w) => (
                <option key={w} value={w}>
                  {w} {t('onboarding.company.weeks')}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            {t('onboarding.company.openingCash')} ({value.currency})
            <input
              type="number"
              min={0}
              step="any"
              value={value.openingCashBalance || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  openingCashBalance: e.target.value === '' ? 0 : Number(e.target.value),
                })
              }
              placeholder={t('onboarding.company.openingCashPlaceholder')}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <OnboardingNav
        showBack={false}
        nextLabel={t('onboarding.nav.nextCompany')}
        onNext={onNext}
        nextDisabled={!canProceed}
      />
    </div>
  );
}
