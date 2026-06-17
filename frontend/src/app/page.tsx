'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Lock, Shield, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { resolvePostAuthPath } from '@/lib/auth-types';
import { DashboardPreviewSection } from '@/components/home/dashboard-preview-section';
import { useTranslations } from '@/lib/i18n';

/** Update this line when beta status changes — layout stays the same. */
const SOCIAL_PROOF_BADGE = 'home.landing.socialProof';

const SECURITY_BADGES = [
  { icon: Lock, titleKey: 'home.landing.security.encryptionTitle', descKey: 'home.landing.security.encryptionDesc' },
  { icon: Shield, titleKey: 'home.landing.security.residencyTitle', descKey: 'home.landing.security.residencyDesc' },
  { icon: Users, titleKey: 'home.landing.security.rbacTitle', descKey: 'home.landing.security.rbacDesc' },
  { icon: ClipboardList, titleKey: 'home.landing.security.auditTitle', descKey: 'home.landing.security.auditDesc' },
] as const;

const CREDIBILITY_ITEMS = [
  'home.landing.credibility.finance',
  'home.landing.credibility.standards',
  'home.landing.credibility.methodology',
] as const;

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
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white">
          L
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">
          {t('home.landing.title')}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          {t('home.landing.subtitle')}
        </p>
        <p
          className="mx-auto mt-5 inline-block rounded-full border px-4 py-1.5 text-xs text-muted-foreground"
          style={{ borderColor: '#00B4D8' }}
        >
          {t(SOCIAL_PROOF_BADGE)}
        </p>
      </div>

      <DashboardPreviewSection />

      <ul className="mx-auto mt-10 max-w-lg space-y-2 text-sm text-muted-foreground">
        {(
          [
            'home.landing.benefitForecast',
            'home.landing.benefitRunway',
            'home.landing.benefitAlerts',
          ] as const
        ).map((key) => (
          <li key={key} className="flex items-start gap-2">
            <span className="shrink-0 text-cash-positive" aria-hidden>
              ✓
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <div className="mx-auto max-w-2xl">
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

        <section className="mt-12 rounded-xl p-6" style={{ backgroundColor: '#F8FAFC' }}>
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-foreground">
            {t('home.landing.security.heading')}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SECURITY_BADGES.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="flex gap-3 rounded-lg bg-white/80 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div
          className="mt-8 flex flex-col items-center justify-center gap-3 rounded-lg px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider sm:flex-row sm:gap-0"
          style={{ backgroundColor: '#EBF4FA', color: '#4A6FA5' }}
        >
          {CREDIBILITY_ITEMS.map((key, index) => (
            <span key={key} className="flex items-center sm:px-4">
              {index > 0 && (
                <span
                  className="mr-4 hidden h-4 w-px sm:inline-block"
                  style={{ backgroundColor: '#4A6FA5', opacity: 0.35 }}
                  aria-hidden
                />
              )}
              {t(key)}
            </span>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
