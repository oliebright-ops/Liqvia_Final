'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { DashboardAlert, liquidityVariant } from '@/lib/dashboard-types';
import { NestedTranslations, TranslateFn } from '@/lib/i18n';
import { alertSeverityLabel, formatAlertMessage } from '@/lib/alert-labels';
import { liquidityLabel } from '@/lib/liquidity-labels';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function severityVariant(severity: string): 'cash-negative' | 'warning' | 'muted' {
  if (severity === 'critical' || severity === 'high') return 'cash-negative';
  if (severity === 'medium') return 'warning';
  return 'muted';
}

export function AlertSection({
  alerts,
  liquidityStatus,
  currency,
  t,
  format,
}: {
  alerts: DashboardAlert[];
  liquidityStatus?: string;
  currency: string;
  t: NestedTranslations;
  format: TranslateFn;
}) {
  const dash = t.dashboard as Record<string, string>;
  const isHealthy = alerts.length === 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/forecast"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CardTitle className="hover:text-primary">{dash.alertsTitle}</CardTitle>
          </Link>
          {liquidityStatus && (
            <Badge variant={liquidityVariant(liquidityStatus)} className="shrink-0">
              {liquidityLabel(format, liquidityStatus)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[320px] flex-1 flex-col p-4 pt-2">
        {isHealthy ? (
          <div
            className={cn(
              'flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center',
              'border-cash-positive/30 bg-cash-positive/5',
            )}
          >
            <ShieldCheck className="mb-3 h-8 w-8 text-cash-positive" aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">{dash.alertsEmpty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 5).map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <Badge variant={severityVariant(a.severity)} className="shrink-0 capitalize">
                  {alertSeverityLabel(format, a.severity)}
                </Badge>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {formatAlertMessage(format, a, currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
