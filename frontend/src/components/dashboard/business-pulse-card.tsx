'use client';

import Link from 'next/link';
import { CircleAlert, CircleCheck, Info, Sparkles } from 'lucide-react';
import { formatCurrency } from '@liqvia2/shared';
import { useBusinessPulse } from '@/hooks/use-business-pulse';
import { useLanguage, TranslateFn } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { alertSeverityLabel } from '@/lib/alert-labels';
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

/** Builds the localized title/message for an item — the backend only sends
 * structured data (name/amount/dates), never pre-formatted English sentences,
 * so this is the one place the wording is assembled and can be translated. */
function describeItem(item: BusinessPulseItemView, format: TranslateFn): { title: string; message: string } {
  const fmt = (n: number) => formatCurrency(n, item.currency);

  switch (item.category) {
    case 'obligation_due': {
      const days = item.daysUntilDue ?? 0;
      const message =
        days <= 0
          ? format('businessPulse.dueToday', { amount: fmt(item.amount), date: item.dueDate ?? '' })
          : format('businessPulse.dueInDays', {
              amount: fmt(item.amount),
              days: String(days),
              date: item.dueDate ?? '',
            });
      return { title: item.name, message };
    }
    case 'overdue_payable':
      return {
        title: format('businessPulse.overdueTitle', { name: item.name }),
        message: format('businessPulse.overdueMessage', {
          amount: fmt(item.amount),
          days: String(item.daysOverdue ?? 0),
          date: item.dueDate ?? '',
        }),
      };
    case 'overdue_receivable':
      return {
        title: format('businessPulse.collectTitle', { name: item.name }),
        message: format('businessPulse.overdueMessage', {
          amount: fmt(item.amount),
          days: String(item.daysOverdue ?? 0),
          date: item.dueDate ?? '',
        }),
      };
    case 'expected_receipt':
      return {
        title: format('businessPulse.expectingTitle', { name: item.name }),
        message: format('businessPulse.expectedMessage', {
          amount: fmt(item.amount),
          days: String(item.daysUntilDue ?? 0),
          date: item.dueDate ?? '',
        }),
      };
    case 'cash_buffer':
      return item.severity === 'critical'
        ? {
            title: format('businessPulse.noBufferTitle'),
            message: format('businessPulse.noBufferMessage', { amount: fmt(item.amount) }),
          }
        : {
            title: format('businessPulse.thinBufferTitle'),
            message: format('businessPulse.thinBufferMessage', {
              amount: fmt(item.amount),
              weeks: (item.runwayWeeks ?? 0).toFixed(1),
            }),
          };
  }
}

function PulseItemRow({ item, format }: { item: BusinessPulseItemView; format: TranslateFn }) {
  const Icon = SEVERITY_ICON[item.severity];
  const { title, message } = describeItem(item, format);
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
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]} className="shrink-0">
        {alertSeverityLabel(format, item.severity)}
      </Badge>
    </Link>
  );
}

export function BusinessPulseCard() {
  const { data, isLoading } = useBusinessPulse();
  const { t, format } = useLanguage();
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
              <PulseItemRow key={item.id} item={item} format={format} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
