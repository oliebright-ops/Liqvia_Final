import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-glow-primary',
  secondary: 'bg-muted text-foreground hover:bg-muted/80',
  ghost: 'hover:bg-muted text-foreground',
  outline: 'border border-border bg-transparent hover:bg-muted',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = 'primary', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
      variants[variant],
      className,
    )}
    {...props}
  />
));
Button.displayName = 'Button';
