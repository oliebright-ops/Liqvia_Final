'use client';

import Link from 'next/link';
import { CircleAlert, CircleCheck, Info, Sparkles } from 'lucide-react';
import { useBusinessPulse } from '@/hooks/use-business-pulse';
import { useLanguage, TranslateFn } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { businessPulsePriorityLabel, describeBusinessPulseItem, t } from '@/lib/business-pulse-copy';
import type { BusinessPulseItemView, PulseSeverity } from '@/lib/module-types';

const SEVERITY_ICON: Record<PulseSeverity, typeof CircleAlert> = {
  critical: CircleAlert,
  warning: CircleAlert,
  info: Info,
};

const SEVERITY_BADGE_VARIANT: Record<PulseSeverity, 'error' | 'warning' | 'muted'> = {
  critical: 'error',
  warning: 'warning',
  info: 'muted',
};

/** Immediate action first, then This week, then Monitor — matches the priority groups. */
const SEVERITY_GROUP_ORDER: PulseSeverity[] = ['critical', 'warning', 'info'];

function PulseItemCard({ item, format }: { item: BusinessPulseItemView; format: TranslateFn }) {
  const Icon = SEVERITY_ICON[item.severity];
  const { title, message, action } = describeBusinessPulseItem(item, format);
  const recommendedActionLabel = t(format, 'modules.businessPulse.recommendedAction', 'Recommended action:');

  return (
    <Link
      href={item.linkPath}
      className="flex items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/40"
    >
      <Icon
        className={
          item.severity === 'critical'
            ? 'mt-0.5 h-4 w-4 shrink-0 text-cash-negative'
            : item.severity === 'warning'
              ? 'mt-0.5 h-4 w-4 shrink-0 text-warning'
              : 'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground'
        }
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]} className="shrink-0">
            {businessPulsePriorityLabel(format, item.severity)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{message}</p>
        <p className="text-xs text-foreground">
          <span className="font-medium text-muted-foreground">{recommendedActionLabel}</span> {action}
        </p>
      </div>
    </Link>
  );
}

function PrioritySection({
  items,
  format,
  label,
}: {
  items: BusinessPulseItemView[];
  format: TranslateFn;
  label: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <PulseItemCard key={item.id} item={item} format={format} />
        ))}
      </div>
    </div>
  );
}

export function BusinessPulseCard() {
  const { data, isLoading } = useBusinessPulse();
  const { format } = useLanguage();

  if (isLoading || !data) return null;

  const title = t(format, 'modules.businessPulse.title', "Today's Business Pulse");
  const subtitle = t(
    format,
    'modules.businessPulse.subtitle',
    'The most important cash flow issues that need your attention.',
  );
  const allClear = t(format, 'modules.businessPulse.allClear', "Nothing urgent today — everything's on track.");

  const grouped = SEVERITY_GROUP_ORDER.map((severity) => ({
    severity,
    items: data.items.filter((item) => item.severity === severity),
  }));

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.briefing && (
          <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
            {data.briefing}
          </p>
        )}
        {data.items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            <CircleCheck className="h-4 w-4 text-cash-positive" />
            {allClear}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ severity, items }) => (
              <PrioritySection
                key={severity}
                items={items}
                format={format}
                label={businessPulsePriorityLabel(format, severity)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
