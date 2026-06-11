'use client';

import { useTranslations } from '@/lib/i18n';

export function WelcomeStep({
  onSetupCompany,
  onDemoMode,
  demoLoading,
}: {
  onSetupCompany: () => void;
  onDemoMode: () => void;
  demoLoading?: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white">
        L
      </div>
      <h2 className="mt-6 text-2xl font-semibold text-white">{t('onboarding.welcome.title')}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
        {t('onboarding.welcome.subtitle')}
      </p>

      <div className="mt-8 space-y-3 text-left">
        <button
          type="button"
          onClick={onSetupCompany}
          className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-4 text-left transition-colors hover:border-blue-500 hover:bg-slate-800"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 text-lg">
              🏢
            </span>
            <div>
              <p className="font-medium text-white">{t('onboarding.welcome.setupTitle')}</p>
              <p className="text-sm text-slate-400">{t('onboarding.welcome.setupHint')}</p>
            </div>
          </div>
          <span className="text-slate-500">›</span>
        </button>

        <button
          type="button"
          onClick={onDemoMode}
          disabled={demoLoading}
          className="flex w-full items-center justify-between rounded-xl border border-amber-700/50 bg-amber-950/30 px-5 py-4 text-left transition-colors hover:border-amber-500 hover:bg-amber-950/50 disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-lg">
              🧪
            </span>
            <div>
              <p className="font-medium text-amber-100">{t('onboarding.welcome.demoTitle')}</p>
              <p className="text-sm text-amber-200/70">{t('onboarding.welcome.demoHint')}</p>
            </div>
          </div>
          <span className="text-amber-400/70">›</span>
        </button>
      </div>

      <p className="mt-8 text-xs text-slate-500">{t('onboarding.welcome.noLinks')}</p>
    </div>
  );
}
