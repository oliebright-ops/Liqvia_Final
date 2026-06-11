'use client';

import { useTranslations } from '@/lib/i18n';

export function OnboardingNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  nextLoading,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showBack?: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-800 pt-6">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
        >
          {t('onboarding.nav.back')}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || nextLoading}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLoading ? t('onboarding.nav.creating') : nextLabel}
      </button>
    </div>
  );
}
