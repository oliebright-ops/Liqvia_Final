'use client';

import { liquidityLabel } from '@/lib/liquidity-labels';
import { liquidityVariant } from '@/lib/dashboard-types';
import type { KpiCardViewModel } from '@/lib/dashboard-controller';
import type { TranslateFn } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { InfoHint } from '@/components/ui/info-hint';
import { KpiCard } from './kpi-card';

/** Render-only KPI grid — all values pre-computed by the dashboard controller. */
export function KpiGrid({
  cards,
  format,
}: {
  cards: KpiCardViewModel[];
  format: TranslateFn;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          href={card.href}
          label={card.label}
          labelAdornment={
            card.hint ? (
              <InfoHint label={card.hintAriaLabel ?? card.label}>{card.hint}</InfoHint>
            ) : undefined
          }
          value={card.value}
          subtitle={card.subtitle}
          changeBadge={card.changeBadge}
          changeLabel={card.changeLabel}
          negative={card.negative}
          primary={card.primary}
          badge={
            card.badgeStatus ? (
              <Badge variant={liquidityVariant(card.badgeStatus)}>
                {liquidityLabel(format, card.badgeStatus)}
              </Badge>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
