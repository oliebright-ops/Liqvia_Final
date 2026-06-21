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
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/uploads?welcome=1"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          {t('onboarding.done.goUploads')}
        </Link>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
        >
          {t('onboarding.done.goDashboard')}
        </Link>
      </div>
    </div>
  );
}
