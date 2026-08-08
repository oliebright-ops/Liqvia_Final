import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Same HSL values as the Liqvia product's dark theme (frontend/src/app/globals.css --background/
 * --card/--border/--primary). Reused here as arbitrary-value classes so the "product" sections of
 * this page read as genuine Liqvia UI rather than an invented palette.
 */
export const NAVY_BG = 'bg-[hsl(224,56%,5%)]';
export const NAVY_CARD = 'bg-[hsl(222,47%,9%)]';
export const NAVY_BORDER = 'border-[hsl(222,30%,18%)]';
export const NAVY_ACCENT_TEXT = 'text-[hsl(221,94%,68%)]';
export const NAVY_ACCENT_BG = 'bg-[hsl(221,94%,68%)]';
export const CASH_POSITIVE = 'text-[hsl(152,60%,45%)]';
export const CASH_NEGATIVE = 'text-[hsl(0,72%,58%)]';
export const CASH_WARNING = 'text-[hsl(38,92%,55%)]';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-6', className)} {...props} />;
}

interface SectionProps extends HTMLAttributes<HTMLElement> {
  tone?: 'white' | 'slate' | 'navy';
  id?: string;
}

export function Section({ className, tone = 'white', id, children, ...props }: SectionProps) {
  const toneClass = tone === 'slate' ? 'bg-slate-50' : tone === 'navy' ? NAVY_BG : 'bg-white';
  return (
    <section id={id} className={cn('scroll-mt-20 py-16 sm:py-24', toneClass, className)} {...props}>
      {children}
    </section>
  );
}

export function Eyebrow({ children, invert = false }: { children: ReactNode; invert?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        invert ? 'border-blue-400/30 bg-blue-400/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-800',
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  center = false,
  invert = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  center?: boolean;
  invert?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      {eyebrow && <Eyebrow invert={invert}>{eyebrow}</Eyebrow>}
      <h2
        className={cn(
          'mt-4 text-3xl font-semibold tracking-tight sm:text-4xl',
          invert ? 'text-white' : 'text-slate-900',
        )}
      >
        {title}
      </h2>
      {lede && (
        <p className={cn('mt-4 text-lg leading-relaxed', invert ? 'text-slate-300' : 'text-slate-600')}>{lede}</p>
      )}
    </div>
  );
}

export function PrimaryCta({
  href = '/#apply',
  children,
  className,
  ...rest
}: {
  href?: string;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-blue-600 px-7 py-3 text-center text-base font-semibold leading-snug text-white shadow-sm transition-colors hover:bg-blue-500',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}

export function SecondaryCta({
  href = '/#apply',
  children,
  sub,
  invert = false,
  className,
  ...rest
}: {
  href?: string;
  children: ReactNode;
  sub?: ReactNode;
  invert?: boolean;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[12px] border px-7 py-2.5 text-center leading-snug transition-colors',
        invert
          ? 'border-white/25 bg-transparent text-white hover:bg-white/10'
          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      <span className="text-base font-semibold">{children}</span>
      {sub && <span className={cn('text-xs font-medium', invert ? 'text-slate-300' : 'text-slate-500')}>{sub}</span>}
    </a>
  );
}

/** Small non-clickable availability pill, e.g. next to a hero CTA. */
export function AvailabilityBadge({ children, invert = false }: { children: ReactNode; invert?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
        invert ? 'border-blue-400/30 bg-blue-400/10 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-800',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', invert ? 'bg-blue-300' : 'bg-blue-600')} aria-hidden />
      {children}
    </span>
  );
}

type StatusVariant = 'positive' | 'warning' | 'negative' | 'neutral';

const STATUS_STYLES: Record<StatusVariant, string> = {
  positive: 'bg-[hsl(152,60%,45%)]/15 text-[hsl(152,60%,55%)]',
  warning: 'bg-[hsl(38,92%,55%)]/15 text-[hsl(38,92%,60%)]',
  negative: 'bg-[hsl(0,72%,58%)]/15 text-[hsl(0,72%,65%)]',
  neutral: 'bg-slate-500/15 text-slate-300',
};

/** Compact status pill for product-preview panels (dark backgrounds only). */
export function StatusBadge({ variant, children }: { variant: StatusVariant; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        STATUS_STYLES[variant],
      )}
    >
      {children}
    </span>
  );
}

/** Tabular-numeral span for currency, weeks and other financial figures. */
export function MonoStat({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('font-mono tabular-nums', className)}>{children}</span>;
}
