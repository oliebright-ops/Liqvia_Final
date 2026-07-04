'use client';

import Link from 'next/link';
import { CircleAlert, CircleCheck, Info, Sparkles } from 'lucide-react';
import { useBusinessPulse } from '@/hooks/use-business-pulse';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function PulseItemRow({ item }: { item: BusinessPulseItemView }) {
  const Icon = SEVERITY_ICON[item.severity];
  return (
    <Link
      href={item.linkPath}
      className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted/40"
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.message}</p>
      </div>
      <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]} className="shrink-0">
        {item.severity}
      </Badge>
    </Link>
  );
}

export function BusinessPulseCard() {
  const { data, isLoading } = useBusinessPulse();
  const { t } = useLanguage();
  const bp = (t.modules as Record<string, Record<string, unknown>>).businessPulse as Record<
    string,
    string
  >;

  if (isLoading || !data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm">{bp.title}</CardTitle>
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
            {bp.allClear}
          </div>
        ) : (
          <div className="space-y-2">
            {data.items.map((item) => (
              <PulseItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
