'use client';

import { OnboardingPhase, SETUP_STEPS } from '@liqvia2/shared';
import { CompanySwitcher } from '@/components/layout/company-switcher';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useTranslations } from '@/lib/i18n';

const PREBOARDING: OnboardingPhase[] = ['welcome', 'select'];

export function OnboardingShell({
  phase,
  children,
}: {
  phase: OnboardingPhase;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const showStepper = !PREBOARDING.includes(phase) && phase !== 'done';
  const stepIndex = SETUP_STEPS.indexOf(phase);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              L
            </div>
            <h1 className="text-lg font-semibold tracking-tight">{t('onboarding.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <CompanySwitcher compact tone="dark" />
            <LanguageSwitcher variant="pills" tone="dark" className="border-slate-700" />
          </div>
        </div>

        {showStepper && stepIndex >= 0 && (
          <nav className="mb-8 flex items-center justify-between gap-2">
            {SETUP_STEPS.map((s, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <div key={s} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      active
                        ? 'bg-blue-600 text-white'
                        : done
                          ? 'bg-slate-700 text-slate-200'
                          : 'border border-slate-600 text-slate-500'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`text-center text-xs ${
                      active ? 'font-medium text-blue-400' : 'text-slate-500'
                    }`}
                  >
                    {t(`onboarding.steps.${s}`)}
                  </span>
                </div>
              );
            })}
          </nav>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
