'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useTranslations } from '@/lib/i18n';

interface LandingHeaderProps {
  onRequestDemo: () => void;
  demoLoading: boolean;
  disabled: boolean;
}

const NAV_LINKS = [
  { href: '#product', key: 'nav.marketing.product' },
  { href: '#solutions', key: 'nav.marketing.solutions' },
  { href: '#resources', key: 'nav.marketing.resources' },
] as const;

export function LandingHeader({ onRequestDemo, demoLoading, disabled }: LandingHeaderProps) {
  const t = useTranslations();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
            Liqvia
          </Link>
          <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary sm:inline-block">
            {t('nav.marketing.badge')}
          </span>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map(({ href, key }) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('auth.signIn')}
          </Link>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || demoLoading}
            onClick={onRequestDemo}
            className="h-9 px-3 text-sm sm:px-4"
          >
            {t('nav.marketing.requestDemo')}
          </Button>
        </div>
      </div>
    </header>
  );
}
