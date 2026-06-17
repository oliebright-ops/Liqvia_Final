'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';

/** Update when beta status changes — layout stays the same. */
const SOCIAL_PROOF_BADGE = 'home.landing.socialProof';

const PARTNER_AVATARS = [
  { id: 'a', gradient: 'from-sky-500 to-blue-600', initials: 'FL' },
  { id: 'b', gradient: 'from-violet-500 to-purple-600', initials: 'MR' },
  { id: 'c', gradient: 'from-emerald-500 to-teal-600', initials: 'SK' },
  { id: 'd', gradient: 'from-amber-500 to-orange-600', initials: 'JP' },
] as const;

interface HeroCtaSectionProps {
  onExploreDemo: () => void;
  demoLoading: boolean;
  disabled: boolean;
  demoError: string | null;
}

export function HeroCtaSection({
  onExploreDemo,
  demoLoading,
  disabled,
  demoError,
}: HeroCtaSectionProps) {
  const t = useTranslations();

  return (
    <section className="mx-auto max-w-2xl text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white sm:h-14 sm:w-14 sm:text-2xl">
        L
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:mt-5 sm:text-4xl">
        {t('home.landing.title')}
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground sm:mt-4 sm:text-lg">
        {t('home.landing.subtitle')}
      </p>

      <div className="mt-5 flex flex-col items-center gap-3 sm:mt-6">
        <div className="flex w-full max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <Button
            type="button"
            disabled={disabled || demoLoading}
            onClick={onExploreDemo}
            className="h-12 w-full min-w-[220px] px-8 text-base font-semibold shadow-glow-primary sm:w-auto"
          >
            {demoLoading ? t('home.landing.demoLoading') : t('home.landing.demoTitle')}
          </Button>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('home.landing.demoNoSignup')}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
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

        {demoError && <p className="text-sm text-red-600">{demoError}</p>}
      </div>

      <p
        className="mx-auto mt-5 inline-block rounded-full border px-4 py-1.5 text-xs text-muted-foreground"
        style={{ borderColor: '#00B4D8' }}
      >
        {t(SOCIAL_PROOF_BADGE)}
      </p>

      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
        <div className="flex items-center -space-x-2.5" aria-hidden>
          {PARTNER_AVATARS.map(({ id, gradient, initials }) => (
            <span
              key={id}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm ${gradient}`}
            >
              {initials}
            </span>
          ))}
        </div>
        <p className="text-left text-xs text-muted-foreground">{t('home.landing.partnerAvatarsCaption')}</p>
      </div>
    </section>
  );
}
