'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  labelAdornment,
  value,
  subtitle,
  href,
  changeBadge,
  changeLabel,
  badge,
  negative,
  primary,
}: {
  label: string;
  labelAdornment?: React.ReactNode;
  value: string;
  subtitle?: string;
  href?: string;
  changeBadge?: string;
  changeLabel?: string;
  badge?: React.ReactNode;
  negative?: boolean;
  primary?: boolean;
}) {
  const changePositive = changeBadge?.startsWith('+');

  const card = (
    <Card
      className={cn(
        'h-full transition-colors',
        href && 'cursor-pointer hover:border-primary/40 hover:shadow-glow-primary',
        primary &&
          'border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 shadow-glow-primary',
      )}
    >
      <CardContent className="flex h-full flex-col p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          {labelAdornment}
        </p>
        <p
          className={cn(
            'mt-2 font-mono text-2xl font-semibold tabular-nums',
            negative ? 'text-cash-negative' : 'text-foreground',
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <div>
            {changeBadge && (
              <span
                className={cn(
                  'font-mono text-xs font-semibold tabular-nums',
                  changePositive ? 'text-cash-positive' : 'text-cash-negative',
                )}
              >
                {changeBadge}
              </span>
            )}
            {changeLabel && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{changeLabel}</p>
            )}
          </div>
          {badge}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {card}
      </Link>
    );
  }

  return card;
}
