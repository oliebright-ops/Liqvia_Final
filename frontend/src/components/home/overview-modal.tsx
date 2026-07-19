'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CHART_COLORS, chartAxisStyle } from '@/components/charts/chart-theme';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { CURRENCY, buildChartData, useMountReady } from './product-preview';
import { useTranslations } from '@/lib/i18n';
import { formatCurrency } from '@liqvia2/shared';
import { cn } from '@/lib/utils';

const SCENE_KEYS = ['cash', 'forecast', 'obligations', 'insight', 'decide'] as const;
type SceneKey = (typeof SCENE_KEYS)[number];

const SCENE_DURATIONS_MS: Record<SceneKey, number> = {
  cash: 24_000,
  forecast: 26_000,
  obligations: 22_000,
  insight: 24_000,
  decide: 24_000,
};

const TICK_MS = 50;

interface OverviewModalProps {
  open: boolean;
  onClose: () => void;
  onExploreDemo: () => void;
}

export function OverviewModal({ open, onClose, onExploreDemo }: OverviewModalProps) {
  const t = useTranslations();
  const p = 'home.landing.hero.overview';
  const pp = 'home.landing.hero.preview';

  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setElapsed(0);
      setPlaying(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !playing) return;
    const duration = SCENE_DURATIONS_MS[SCENE_KEYS[index]];
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + TICK_MS;
        if (next >= duration) {
          setIndex((i) => {
            if (i >= SCENE_KEYS.length - 1) {
              setPlaying(false);
              return i;
            }
            return i + 1;
          });
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [open, playing, index]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const scene = SCENE_KEYS[index];

  function jumpTo(i: number) {
    setIndex(i);
    setElapsed(0);
    setPlaying(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(`${p}.title`)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_28px_70px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress segments */}
        <div className="flex gap-1.5 p-4 pb-0">
          {SCENE_KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => jumpTo(i)}
              aria-label={t(`${p}.scenes.${key}.title`)}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: i < index ? '100%' : i > index ? '0%' : `${(elapsed / SCENE_DURATIONS_MS[key]) * 100}%`,
                  transition: i === index ? 'width 50ms linear' : undefined,
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(`${p}.title`)}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(`${p}.close`)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scene stage */}
        <div className="flex min-h-[320px] flex-col justify-center px-6 py-8 sm:min-h-[380px] sm:px-10">
          {scene === 'cash' && <CashScene t={t} pp={pp} />}
          {scene === 'forecast' && <ForecastScene t={t} pp={pp} />}
          {scene === 'obligations' && <ObligationsScene t={t} pp={pp} />}
          {scene === 'insight' && <InsightScene t={t} p={p} />}
          {scene === 'decide' && (
            <DecideScene
              t={t}
              pp={pp}
              onExploreDemo={() => {
                onClose();
                onExploreDemo();
              }}
            />
          )}
        </div>

        {/* Caption + controls */}
        <div className="flex items-end justify-between gap-4 border-t border-border px-6 py-4 sm:px-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t(`${p}.scenes.${scene}.title`)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t(`${p}.scenes.${scene}.caption`)}</p>
          </div>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={t(playing ? `${p}.pause` : `${p}.play`)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

type T = (key: string, params?: Record<string, string>) => string;

function CashScene({ t, pp }: { t: T; pp: string }) {
  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3">
      <KpiCard label={t(`${pp}.kpi.currentCash`)} value={formatCurrency(247800, CURRENCY)} primary />
      <KpiCard
        label={t(`${pp}.kpi.cashRunway`)}
        value={t(`${pp}.kpi.cashRunwayValue`)}
        subtitle={t(`${pp}.kpi.cashRunwaySubtitle`)}
      />
    </div>
  );
}

function ForecastScene({ t, pp }: { t: T; pp: string }) {
  const weekLabel = (i: number) => (i === 0 ? t(`${pp}.chart.today`) : `${t(`${pp}.chart.weekPrefix`)}${i}`);
  const data = useMemo(() => buildChartData('expected', weekLabel), [t]);
  const ready = useMountReady();

  return (
    <div className="mx-auto w-full max-w-lg">
      <p className="text-center text-sm font-medium text-muted-foreground">{t(`${pp}.chart.title`)}</p>
      {!ready ? (
        <div style={{ width: '100%', height: 180 }} />
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="week" {...chartAxisStyle} interval={2} />
            <Area
              dataKey="band"
              stroke="none"
              fill={CHART_COLORS.primary}
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="closing"
              stroke={CHART_COLORS.primary}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const SCENE_OBLIGATIONS = [
  { key: 'payroll', amount: 42000, due: 'Jul 25', status: 'dueSoon' },
  { key: 'gst', amount: 18400, due: 'Aug 1', status: 'scheduled' },
  { key: 'rent', amount: 9200, due: 'Jul 21', status: 'dueSoon' },
] as const;

const SCENE_STATUS_BADGE: Record<(typeof SCENE_OBLIGATIONS)[number]['status'], 'warning' | 'muted'> = {
  dueSoon: 'warning',
  scheduled: 'muted',
};

function ObligationsScene({ t, pp }: { t: T; pp: string }) {
  return (
    <div className="mx-auto w-full max-w-sm space-y-2.5">
      {SCENE_OBLIGATIONS.map((o) => (
        <div key={o.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">{t(`${pp}.obligations.names.${o.key}`)}</p>
            <p className="text-xs text-muted-foreground">
              {t(`${pp}.obligations.due`)} {o.due}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(o.amount, CURRENCY)}
            </p>
            <Badge variant={SCENE_STATUS_BADGE[o.status]}>{t(`${pp}.obligations.status.${o.status}`)}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightScene({ t, p }: { t: T; p: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-5">
      <span className="mt-0.5 text-lg text-primary" aria-hidden>
        ✦
      </span>
      <p className="text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold text-primary">{t(`${p}.scenes.insight.badge`)}</span>{' '}
        {t(`${p}.scenes.insight.snippet`)}
      </p>
    </div>
  );
}

function DecideScene({ t, pp, onExploreDemo }: { t: T; pp: string; onExploreDemo: () => void }) {
  const options: Array<'expected' | 'optimistic' | 'conservative'> = ['expected', 'optimistic', 'conservative'];
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-semibold">
        {options.map((key) => (
          <span
            key={key}
            className={cn(
              'rounded-md px-3 py-1.5',
              key === 'optimistic' ? 'bg-primary text-primary-foreground shadow-glow-primary' : 'text-muted-foreground',
            )}
          >
            {t(`${pp}.scenario.${key}`)}
          </span>
        ))}
      </div>
      <Button type="button" onClick={onExploreDemo} className="h-11 px-6 text-sm font-semibold shadow-glow-primary">
        {t('home.landing.hero.ctaPrimary')}
      </Button>
    </div>
  );
}
