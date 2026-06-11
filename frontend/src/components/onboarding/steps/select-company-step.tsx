'use client';

import { CompanyLink } from '@/lib/auth-types';
import { useTranslations } from '@/lib/i18n';

export function SelectCompanyStep({
  links,
  onSelect,
  onDemoMode,
  selecting,
  demoLoading,
  error,
}: {
  links: CompanyLink[];
  onSelect: (companyId: string) => void;
  onDemoMode: () => void;
  selecting: string | null;
  demoLoading?: boolean;
  error: string | null;
}) {
  const t = useTranslations();

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">{t('onboarding.select.title')}</h2>
      <p className="mt-2 text-sm text-slate-400">{t('onboarding.select.subtitle')}</p>

      <ul className="mt-6 space-y-3">
        {links.map((link) => (
          <li key={link.companyId}>
            <button
              type="button"
              disabled={Boolean(selecting)}
              onClick={() => onSelect(link.companyId)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-4 text-left transition-colors hover:border-blue-500 hover:bg-slate-800 disabled:opacity-50"
            >
              <div>
                <p className="font-medium text-white">{link.companyName}</p>
                <p className="text-sm text-slate-400">
                  {t('onboarding.select.role', { role: link.role })}
                  {link.onboardingCompleted
                    ? ` · ${t('onboarding.select.ready')}`
                    : ` · ${t('onboarding.select.setupRequired')}`}
                </p>
              </div>
              <span className="text-sm text-slate-500">
                {selecting === link.companyId ? '…' : '›'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-slate-800 pt-6">
        <button
          type="button"
          onClick={onDemoMode}
          disabled={demoLoading || Boolean(selecting)}
          className="flex w-full items-center justify-between rounded-xl border border-amber-700/50 bg-amber-950/30 px-5 py-4 text-left transition-colors hover:border-amber-500 disabled:opacity-50"
        >
          <div>
            <p className="font-medium text-amber-100">{t('onboarding.welcome.demoTitle')}</p>
            <p className="text-sm text-amber-200/70">{t('onboarding.welcome.demoHint')}</p>
          </div>
          <span className="text-amber-400/70">›</span>
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
