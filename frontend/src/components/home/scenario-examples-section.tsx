'use client';

import Link from 'next/link';
import { TrendingDown, Users, Clock } from 'lucide-react';
import { SCENARIO_PRESETS } from '@/lib/scenario-presets';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

const PRESET_ICONS = {
  revenue_drop_20: TrendingDown,
  hire_three: Users,
  payments_slow_15: Clock,
} as const;

export function ScenarioExamplesSection() {
  const t = useTranslations();

  return (
    <section className="mx-auto mt-16 w-full max-w-[1040px] px-4 pb-4 sm:mt-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {t('home.landing.scenarioExamples.eyebrow')}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('home.landing.scenarioExamples.headline')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t('home.landing.scenarioExamples.intro')}
        </p>
      </div>

      <ul className="mt-10 grid gap-5 sm:grid-cols-3">
        {SCENARIO_PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.id as keyof typeof PRESET_ICONS];
          return (
            <li key={preset.id}>
              <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-4 text-lg font-semibold leading-snug text-foreground">
                  {t(`home.landing.scenarioExamples.${preset.id}.question`)}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`home.landing.scenarioExamples.${preset.id}.model`)}
                </p>
                <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {t('home.landing.scenarioExamples.sliderHint', {
                    label: t(`scenario.presets.${preset.id}`),
                  })}
                </p>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/scenarios">
          <Button variant="outline">{t('home.landing.scenarioExamples.ctaApp')}</Button>
        </Link>
        <Link href="/login">
          <Button>{t('home.landing.scenarioExamples.ctaSignup')}</Button>
        </Link>
      </div>
    </section>
  );
}
