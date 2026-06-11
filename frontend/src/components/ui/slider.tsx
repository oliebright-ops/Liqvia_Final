'use client';

import { cn } from '@/lib/utils';

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}
