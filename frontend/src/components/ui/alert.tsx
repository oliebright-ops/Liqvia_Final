import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type Variant = 'info' | 'success' | 'error';

const styles: Record<Variant, string> = {
  info: 'border-border bg-muted text-foreground',
  success: 'border-cash-positive/30 bg-cash-positive/10 text-cash-positive',
  error: 'border-cash-negative/30 bg-cash-negative/10 text-cash-negative',
};

export function Alert({
  variant = 'info',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={cn('rounded-lg border px-4 py-3 text-sm', styles[variant], className)}
      {...props}
    />
  );
}
