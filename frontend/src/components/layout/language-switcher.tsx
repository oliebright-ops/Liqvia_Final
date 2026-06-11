'use client';

import { SUPPORTED_LOCALES, useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  compact = false,
  variant = 'select',
  className,
  tone = 'default',
}: {
  compact?: boolean;
  variant?: 'select' | 'pills';
  className?: string;
  tone?: 'default' | 'dark';
}) {
  const { locale, setLocale, format } = useLanguage();

  if (variant === 'pills') {
    return (
      <div
        className={cn('flex rounded-lg border border-border p-0.5 text-xs font-medium', className)}
        role="group"
        aria-label={format('common.language')}
      >
        {SUPPORTED_LOCALES.map(({ code, short }) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={cn(
              'rounded-md px-2.5 py-1.5 transition-colors',
              locale === code
                ? tone === 'dark'
                  ? 'bg-slate-700 text-white'
                  : 'bg-primary/15 text-primary'
                : tone === 'dark'
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      aria-label={format('common.language')}
      value={locale}
      onChange={(e) => setLocale(e.target.value as typeof locale)}
      className={cn(
        'rounded-lg border border-border bg-muted text-xs text-muted-foreground focus:border-primary focus:outline-none',
        compact ? 'w-auto px-2 py-1.5' : 'w-full px-2 py-1.5',
      )}
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
