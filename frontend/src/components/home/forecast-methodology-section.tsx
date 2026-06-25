'use client';

import { BarChart3, CheckCircle2, Layers } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

const PILLARS = [
  { key: 'howItWorks' as const, icon: Layers, bullets: ['b1', 'b2', 'b3'] as const },
  { key: 'assumptions' as const, icon: BarChart3, bullets: ['b1', 'b2', 'b3'] as const },
  { key: 'accuracy' as const, icon: CheckCircle2, bullets: ['b1', 'b2', 'b3'] as const },
];

export function ForecastMethodologySection() {
  const t = useTranslations();

  return (
    <section className="mx-auto mt-16 w-full max-w-[1040px] px-4 sm:mt-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {t('home.landing.forecastMethodology.eyebrow')}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('home.landing.forecastMethodology.headline')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t('home.landing.forecastMethodology.intro')}
        </p>
      </div>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
        {PILLARS.map(({ key, icon: Icon, bullets }, index) => (
          <li key={key}>
            <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('home.landing.forecastMethodology.stepLabel', { step: String(index + 1) })}
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {t(`home.landing.forecastMethodology.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(`home.landing.forecastMethodology.${key}.body`)}
              </p>
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{t(`home.landing.forecastMethodology.${key}.${bullet}`)}</span>
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
