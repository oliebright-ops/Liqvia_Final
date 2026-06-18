'use client';

import { Globe } from 'lucide-react';
import { SUPPORTED_LOCALES, useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  compact = false,
  collapsed = false,
  variant = 'select',
  className,
  tone = 'default',
}: {
  compact?: boolean;
  variant?: 'select' | 'pills';
  collapsed?: boolean;
  className?: string;
  tone?: 'default' | 'dark';
}) {
  const { locale, setLocale, format } = useLanguage();
  const languageLabel = format('common.language');

  const usePills = variant === 'pills' || compact;

  if (usePills) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2',
          collapsed && 'w-full flex-col gap-1.5',
          className,
        )}
        role="group"
        aria-label={languageLabel}
      >
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
            tone === 'dark'
              ? 'border-slate-600 bg-slate-800/80 text-slate-300'
              : 'border-primary/30 bg-primary/10 text-primary',
            collapsed && 'w-full justify-center px-1',
          )}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden />
          {!collapsed && <span>{languageLabel}</span>}
        </span>
        <div
          className={cn(
            'flex rounded-lg border p-0.5',
            tone === 'dark'
              ? 'border-slate-600 bg-slate-900/60'
              : 'border-border bg-card shadow-sm',
            collapsed ? 'w-full flex-col' : 'text-xs font-semibold',
          )}
        >
          {SUPPORTED_LOCALES.map(({ code, short }) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              title={SUPPORTED_LOCALES.find((l) => l.code === code)?.label}
              className={cn(
                'rounded-md px-2.5 py-1.5 transition-all',
                collapsed && 'w-full text-center',
                locale === code
                  ? tone === 'dark'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-primary text-primary-foreground shadow-glow-primary'
                  : tone === 'dark'
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {short}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label className={cn('inline-flex items-center gap-2', className)}>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <Globe className="h-3.5 w-3.5" aria-hidden />
        {languageLabel}
      </span>
      <select
        aria-label={languageLabel}
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className={cn(
          'rounded-lg border border-border bg-card text-sm font-medium text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
          compact ? 'px-2 py-1.5' : 'w-full px-3 py-2',
        )}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
