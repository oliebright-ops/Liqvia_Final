'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export function DoneStep() {
  const t = useTranslations();

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-3xl text-emerald-400">
        ✓
      </div>
      <h2 className="mt-6 text-2xl font-semibold text-white">{t('onboarding.done.title')}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
        {t('onboarding.done.subtitle')}
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        {t('onboarding.done.goDashboard')}
      </Link>
    </div>
  );
}
