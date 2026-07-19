'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  MIXED_DEMO_COMPANY_ID,
  NDIS_DEMO_COMPANY_ID,
  SUBSCRIPTION_DEMO_COMPANY_ID,
} from '@liqvia2/shared';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { OverviewModal } from './overview-modal';
import { ProductPreview } from './product-preview';

const PARTNER_AVATARS = [
  { id: 'a', gradient: 'from-sky-500 to-blue-600', initials: 'FL' },
  { id: 'b', gradient: 'from-violet-500 to-purple-600', initials: 'MR' },
  { id: 'c', gradient: 'from-emerald-500 to-teal-600', initials: 'SK' },
  { id: 'd', gradient: 'from-amber-500 to-orange-600', initials: 'JP' },
] as const;

// Lets a first-time visitor — the "no sign-up required" path most testers actually use —
// pick the demo entity closest to their own cash model instead of always landing on the
// default invoice-driven consulting company.
const ALT_DEMOS = [
  { key: 'ndis', companyId: NDIS_DEMO_COMPANY_ID, labelKey: 'home.landing.demoAlt.ndis' },
  { key: 'subscription', companyId: SUBSCRIPTION_DEMO_COMPANY_ID, labelKey: 'home.landing.demoAlt.subscription' },
  { key: 'mixed', companyId: MIXED_DEMO_COMPANY_ID, labelKey: 'home.landing.demoAlt.mixed' },
] as const;

const FEATURE_PILLS = [
  'cashPosition',
  'cashForecast',
  'obligations',
  'aiInsights',
  'scenarioPlanning',
  'explainableForecasts',
] as const;

interface HeroSectionProps {
  onExploreDemo: (companyId?: string) => void;
  demoLoading: boolean;
  disabled: boolean;
  demoError: string | null;
}

export function HeroSection({ onExploreDemo, demoLoading, disabled, demoError }: HeroSectionProps) {
  const t = useTranslations();
  const [overviewOpen, setOverviewOpen] = useState(false);

  return (
    <section className="mx-auto flex min-h-[90vh] w-full max-w-[1400px] flex-col items-center justify-center px-6 py-16 lg:flex-row lg:items-start lg:justify-center lg:gap-12 lg:py-12 xl:gap-20">
      {/* Left column — copy, ~42% */}
      <div className="flex w-full flex-col items-center text-center lg:w-[42%] lg:shrink-0 lg:items-start lg:text-left">
        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t('home.landing.hero.eyebrow')}
        </span>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
          <span className="block">{t('home.landing.hero.headlineLine1')}</span>
          <span className="block">{t('home.landing.hero.headlineLine2')}</span>
          <span className="block">{t('home.landing.hero.headlineLine3')}</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t('home.landing.hero.supporting')}
        </p>

        <div className="mt-6 max-w-md rounded-xl border border-border bg-muted/20 px-4 py-3.5 text-sm">
          <p className="text-foreground/90">
            {t('home.landing.hero.trustLine1')} {t('home.landing.hero.trustLine2')}{' '}
            {t('home.landing.hero.trustLine3')}
          </p>
          <p className="mt-1 font-medium text-cash-positive">
            {t('home.landing.hero.trustLine4')} {t('home.landing.hero.trustLine5')}{' '}
            {t('home.landing.hero.trustLine6')}
          </p>
        </div>

        <div className="mt-7 flex w-full max-w-md flex-col items-center gap-2.5 sm:flex-row sm:justify-center lg:justify-start">
          <Button
            type="button"
            disabled={disabled || demoLoading}
            onClick={() => onExploreDemo()}
            className="h-12 w-full px-7 text-base font-semibold shadow-glow-primary sm:w-auto"
          >
            {demoLoading ? t('home.landing.demoLoading') : t('home.landing.hero.ctaPrimary')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOverviewOpen(true)}
            className="h-12 w-full px-7 text-base font-semibold sm:w-auto"
          >
            {t('home.landing.hero.ctaSecondary')}
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{t('home.landing.hero.belowCta')}</p>

        {demoError && <p className="mt-3 text-sm text-red-500">{demoError}</p>}

        <div className="mt-4 flex flex-col items-center gap-1 lg:items-start">
          <p className="text-xs text-muted-foreground">{t('home.landing.demoAltLabel')}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 lg:justify-start">
            {ALT_DEMOS.map(({ key, companyId, labelKey }, i) => (
              <span key={key} className="flex items-center gap-3">
                {i > 0 && (
                  <span className="text-muted-foreground/50" aria-hidden>
                    ·
                  </span>
                )}
                <button
                  type="button"
                  disabled={disabled || demoLoading}
                  onClick={() => onExploreDemo(companyId)}
                  className="text-xs font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {t(labelKey)}
                </button>
              </span>
            ))}
          </div>
        </div>

        <ul className="mt-7 grid w-full max-w-md grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {FEATURE_PILLS.map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm text-foreground/85">
              <span className="shrink-0 text-cash-positive" aria-hidden>
                ✓
              </span>
              <span>{t(`home.landing.hero.pills.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col items-center gap-2 sm:flex-row lg:items-center">
          <div className="flex items-center -space-x-2.5" aria-hidden>
            {PARTNER_AVATARS.map(({ id, gradient, initials }) => (
              <span
                key={id}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm ${gradient}`}
              >
                {initials}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('home.landing.partnerAvatarsCaption')}</p>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t('auth.signIn')}
          </Link>
          <span className="mx-2 text-muted-foreground/50" aria-hidden>
            ·
          </span>
          <Link
            href="/register"
            className="font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t('auth.register')}
          </Link>
        </p>
      </div>

      {/* Right column — live product preview, ~58% */}
      <div className="mt-12 w-full min-w-0 lg:sticky lg:top-24 lg:mt-0 lg:w-[58%]">
        <ProductPreview />
      </div>

      <OverviewModal
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        onExploreDemo={() => onExploreDemo()}
      />
    </section>
  );
}
