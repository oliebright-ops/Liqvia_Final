'use client';

import { useState } from 'react';
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n';

const PILLARS = [
  { key: 'howItWorks' as const, icon: Layers, bullets: ['b1', 'b2', 'b3'] as const },
  { key: 'assumptions' as const, icon: BarChart3, bullets: ['b1', 'b2', 'b3'] as const },
  { key: 'accuracy' as const, icon: CheckCircle2, bullets: ['b1', 'b2', 'b3'] as const },
];

export function ForecastAssumptionsPanel() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t('forecast.assumptionsPanel.title')}</CardTitle>
            <CardDescription>{t('forecast.assumptionsPanel.subtitle')}</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-expanded={open}
          >
            {open ? t('forecast.assumptionsPanel.collapse') : t('forecast.assumptionsPanel.expand')}
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 border-t border-border pt-4">
          <ol className="grid gap-4 lg:grid-cols-3">
            {PILLARS.map(({ key, icon: Icon, bullets }, index) => (
              <li key={key}>
                <article className="flex h-full flex-col rounded-lg border border-border bg-muted/20 p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('forecast.assumptionsPanel.stepLabel', { step: String(index + 1) })}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">
                    {t(`forecast.assumptionsPanel.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t(`forecast.assumptionsPanel.${key}.body`)}
                  </p>
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        <span>{t(`forecast.assumptionsPanel.${key}.${bullet}`)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}
