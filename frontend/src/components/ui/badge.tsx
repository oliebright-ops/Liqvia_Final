import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type Variant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'muted'
  | 'cash-positive'
  | 'cash-negative';

const styles: Record<Variant, string> = {
  default: 'bg-muted text-foreground',
  success: 'bg-cash-positive/15 text-cash-positive',
  warning: 'bg-amber-500/15 text-amber-400',
  error: 'bg-cash-negative/15 text-cash-negative',
  muted: 'bg-muted text-muted-foreground',
  'cash-positive': 'bg-cash-positive/15 text-cash-positive',
  'cash-negative': 'bg-cash-negative/15 text-cash-negative',
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
