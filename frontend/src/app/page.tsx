'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { CredibilityBannerSection } from '@/components/home/credibility-banner-section';
import { DashboardPreviewSection } from '@/components/home/dashboard-preview-section';
import { ForecastMethodologySection } from '@/components/home/forecast-methodology-section';
import { HeroSection } from '@/components/home/hero-section';
import { LandingHeader } from '@/components/home/landing-header';
import { ScenarioExamplesSection } from '@/components/home/scenario-examples-section';
import { SecurityTrustSection } from '@/components/home/security-trust-section';
import { useAuth } from '@/lib/auth-context';
import { resolvePostAuthPath } from '@/lib/auth-types';
import { useTranslations } from '@/lib/i18n';

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, loading, exploreDemo } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function onExploreDemo(companyId?: string) {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await exploreDemo(companyId);
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
    <AppShell
      header={
        <LandingHeader
          onRequestDemo={() => void onExploreDemo()}
          demoLoading={demoLoading}
          disabled={loading}
        />
      }
      mainClassName="max-w-none px-0 py-0"
    >
      <HeroSection
        onExploreDemo={(companyId) => void onExploreDemo(companyId)}
        demoLoading={demoLoading}
        disabled={loading}
        demoError={demoError}
      />

      <div className="mx-auto max-w-6xl px-6 pb-8">
        <div
          id="product"
          className="relative mt-2 scroll-mt-20 overflow-hidden rounded-3xl border border-slate-800/50 bg-[#0B0D12] px-4 pb-16 pt-10 sm:px-8 sm:pt-12"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(59,130,246,0.12),transparent_55%)]"
            aria-hidden
          />
          <DashboardPreviewSection />
          <SecurityTrustSection />
          <CredibilityBannerSection />
        </div>

        <div id="resources" className="scroll-mt-20">
          <ForecastMethodologySection />
        </div>
        <div id="solutions" className="scroll-mt-20">
          <ScenarioExamplesSection />
        </div>

        <ul className="mx-auto mt-8 max-w-lg space-y-2 text-sm text-muted-foreground sm:mt-10">
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
      </div>
    </AppShell>
  );
}
