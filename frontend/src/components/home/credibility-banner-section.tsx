'use client';

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Briefcase,
  CalendarRange,
  ClipboardList,
  Globe2,
  Landmark,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

const CREDIBILITY_BADGES: Array<{
  key:
    | 'badgeFinanceExpertise'
    | 'badgeTreasuryPractices'
    | 'badgeIfrs'
    | 'badgeGaap'
    | 'badgeCashFlowMethodology'
    | 'badgeAuditReporting';
  icon: LucideIcon;
}> = [
  { key: 'badgeFinanceExpertise', icon: Briefcase },
  { key: 'badgeTreasuryPractices', icon: Landmark },
  { key: 'badgeIfrs', icon: Globe2 },
  { key: 'badgeGaap', icon: BookOpen },
  { key: 'badgeCashFlowMethodology', icon: CalendarRange },
  { key: 'badgeAuditReporting', icon: ClipboardList },
];

export function CredibilityBannerSection() {
  const t = useTranslations();

  return (
    <section className="mx-auto mt-16 w-full max-w-[1040px] px-4 sm:mt-20">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
        <div className="lg:py-2">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
            {t('home.landing.credibility.headline')}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400">
            {t('home.landing.credibility.body')}
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {CREDIBILITY_BADGES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <article className="group flex h-full flex-col gap-3 rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-5 transition-all duration-300 hover:scale-[1.02] hover:border-primary/35 hover:bg-slate-900/50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-600/70 text-slate-300 transition-colors duration-300 group-hover:border-slate-500 group-hover:text-slate-200">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-sm font-medium leading-snug text-slate-200">
                  {t(`home.landing.credibility.${key}`)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
