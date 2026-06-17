'use client';

import type { LucideIcon } from 'lucide-react';
import { FileText, Globe, ShieldCheck, UserCog } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

const TRUST_CARDS: Array<{
  icon: LucideIcon;
  titleKey: 'bankGradeTitle' | 'controlledAccessTitle' | 'auditTitle' | 'residencyTitle';
  descKey: 'bankGradeDesc' | 'controlledAccessDesc' | 'auditDesc' | 'residencyDesc';
}> = [
  { icon: ShieldCheck, titleKey: 'bankGradeTitle', descKey: 'bankGradeDesc' },
  { icon: UserCog, titleKey: 'controlledAccessTitle', descKey: 'controlledAccessDesc' },
  { icon: FileText, titleKey: 'auditTitle', descKey: 'auditDesc' },
  { icon: Globe, titleKey: 'residencyTitle', descKey: 'residencyDesc' },
];

export function SecurityTrustSection() {
  const t = useTranslations();

  return (
    <section className="mx-auto mt-16 w-full max-w-[960px] px-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {t('home.landing.security.eyebrow')}
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {t('home.landing.security.headline')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
          {t('home.landing.security.subheadline')}
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {TRUST_CARDS.map(({ icon: Icon, titleKey, descKey }) => (
          <article
            key={titleKey}
            className="group flex h-full min-h-[200px] flex-col rounded-2xl border border-slate-700/60 bg-slate-900/40 p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)] hover:shadow-primary/10"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary/15">
              <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-6 text-lg font-semibold text-white">{t(`home.landing.security.${titleKey}`)}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
              {t(`home.landing.security.${descKey}`)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
