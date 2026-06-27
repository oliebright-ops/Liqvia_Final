'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SCENARIO_PARAM_SPECS } from '@liqvia2/shared';
import { useTranslations } from '@/lib/i18n';

const MECHANICS_KEYS = SCENARIO_PARAM_SPECS.map((s) => s.labelKey);

export function ScenarioMechanicsPanel() {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scenario.mechanics.title')}</CardTitle>
        <CardDescription>{t('scenario.mechanics.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section>
          <h3 className="font-semibold text-foreground">{t('scenario.mechanics.recalcTitle')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('scenario.mechanics.recalcBody')}
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-foreground">{t('scenario.mechanics.slidersTitle')}</h3>
          <dl className="mt-3 space-y-4">
            {MECHANICS_KEYS.map((key) => (
              <div key={key} className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
                <dt className="text-xs font-medium text-foreground">
                  {t(`scenario.mechanics.sliders.${key}.label`)}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`scenario.mechanics.sliders.${key}.changes`)}
                </dd>
                <dd className="mt-1 text-[11px] leading-relaxed text-muted-foreground/90">
                  <span className="font-medium text-foreground/80">
                    {t('scenario.mechanics.timingLabel')}{' '}
                  </span>
                  {t(`scenario.mechanics.sliders.${key}.timing`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="font-semibold text-foreground">{t('scenario.mechanics.w13Title')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('scenario.mechanics.w13Body')}
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-foreground">{t('scenario.mechanics.unaffectedTitle')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('scenario.mechanics.unaffectedBody')}
          </p>
        </section>

        <section className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
          <h3 className="text-xs font-semibold text-foreground">{t('scenario.mechanics.backtestTitle')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('scenario.mechanics.backtestBody')}
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
