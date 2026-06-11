'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { resolvePostAuthPath } from '@/lib/auth-types';
import { useTranslations } from '@/lib/i18n';

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, loading, exploreDemo } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function onExploreDemo() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await exploreDemo();
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : t('home.landing.demoError'));
    } finally {
      setDemoLoading(false);
    }
  }

  if (!loading && user) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t('home.signedIn.title', { name: user.name })}
          </h1>
          <p className="mt-3 text-muted-foreground">{t('home.signedIn.subtitle')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={() => router.push(resolvePostAuthPath(user))}>
              {user.isDemoMode ? t('home.signedIn.continueDemo') : t('nav.dashboard')}
            </Button>
            {!user.isDemoMode && (
              <Link href="/onboarding">
                <Button variant="secondary">{t('home.signedIn.setup')}</Button>
              </Link>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white">
            L
          </div>
          <p className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t('app.tagline')}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            {t('home.landing.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            {t('home.landing.subtitle')}
          </p>
        </div>

        <div className="mt-10 space-y-3">
          <Link
            href="/login"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-lg">
                🔑
              </span>
              <div>
                <p className="font-medium text-foreground">{t('home.landing.signInTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('home.landing.signInHint')}</p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </Link>

          <Link
            href="/register"
            className="flex w-full items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 text-left transition-colors hover:border-primary hover:shadow-glow-primary"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-lg">
                🏢
              </span>
              <div>
                <p className="font-medium text-foreground">{t('home.landing.registerTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('home.landing.registerHint')}</p>
              </div>
            </div>
            <span className="text-blue-400">›</span>
          </Link>

          <button
            type="button"
            onClick={() => void onExploreDemo()}
            disabled={demoLoading || loading}
            className="flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-left transition-colors hover:border-amber-400 hover:bg-amber-100/80 disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-lg">
                🧪
              </span>
              <div>
                <p className="font-medium text-amber-950">{t('home.landing.demoTitle')}</p>
                <p className="text-sm text-amber-900/70">{t('home.landing.demoHint')}</p>
              </div>
            </div>
            <span className="text-amber-600">{demoLoading ? '…' : '›'}</span>
          </button>
        </div>

        {demoError && <p className="mt-4 text-center text-sm text-red-600">{demoError}</p>}

        <ul className="mx-auto mt-10 max-w-lg space-y-2 text-sm text-muted-foreground">
          {(['dashboard', 'bankAccounts', 'planning', 'aiCfo'] as const).map((key) => (
            <li key={key} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{t(`app.feature.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
