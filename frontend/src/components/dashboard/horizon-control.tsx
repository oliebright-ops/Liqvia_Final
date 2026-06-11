'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clampForecastHorizon, FORECAST_HORIZON_MAX, FORECAST_HORIZON_MIN } from '@liqvia2/shared';
import { apiPatch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TranslateFn } from '@/lib/i18n';
import { Slider } from '@/components/ui/slider';

export function HorizonControl({
  horizonWeeks,
  onHorizonChange,
  format,
  disabled,
}: {
  horizonWeeks: number;
  onHorizonChange: (weeks: number) => void;
  format: TranslateFn;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [local, setLocal] = useState(horizonWeeks);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(horizonWeeks);
  }, [horizonWeeks]);

  const persist = useCallback(
    async (weeks: number) => {
      if (!user?.companyId || disabled) return;
      const clamped = clampForecastHorizon(weeks);
      setSaving(true);
      try {
        await apiPatch('/settings/horizon', { forecastHorizonWeeks: clamped });
      } finally {
        setSaving(false);
      }
    },
    [user?.companyId, disabled],
  );

  const schedulePersist = useCallback(
    (weeks: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void persist(weeks);
      }, 450);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div className="flex min-w-[11rem] max-w-[14rem] flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{format('dashboard.horizonLabel')}</span>
        <span className="font-mono tabular-nums text-foreground">
          {local}w{saving ? ' …' : ''}
        </span>
      </div>
      <Slider
        value={local}
        min={FORECAST_HORIZON_MIN}
        max={FORECAST_HORIZON_MAX}
        disabled={disabled || saving}
        aria-label={format('dashboard.horizonLabel')}
        onChange={(v) => {
          const next = clampForecastHorizon(v);
          setLocal(next);
          onHorizonChange(next);
          schedulePersist(next);
        }}
      />
      <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{format('dashboard.horizonWeeksShort')}</span>
        <input
          type="number"
          min={FORECAST_HORIZON_MIN}
          max={FORECAST_HORIZON_MAX}
          value={local}
          disabled={disabled || saving}
          onChange={(e) => {
            const next = clampForecastHorizon(Number(e.target.value));
            setLocal(next);
            onHorizonChange(next);
            schedulePersist(next);
          }}
          className="w-14 rounded border border-border bg-background px-2 py-0.5 font-mono text-xs tabular-nums text-foreground"
        />
      </label>
    </div>
  );
}
