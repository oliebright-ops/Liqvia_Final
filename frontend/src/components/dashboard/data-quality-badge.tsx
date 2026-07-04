'use client';

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useDataQuality } from '@/hooks/use-data-quality';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DataQualityModuleStatus, DataQualityReportView } from '@/lib/module-types';

const STATUS_ICON: Record<DataQualityModuleStatus, typeof CheckCircle2> = {
  fresh: CheckCircle2,
  stale: AlertTriangle,
  missing: XCircle,
};

const STATUS_BADGE_VARIANT: Record<DataQualityModuleStatus, 'success' | 'warning' | 'error'> = {
  fresh: 'success',
  stale: 'warning',
  missing: 'error',
};

function scoreVariant(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

export function DataQualityBadge() {
  const { data, isLoading } = useDataQuality();
  const { t } = useLanguage();
  const dq = (t.modules as Record<string, Record<string, unknown>>).dataQuality as Record<
    string,
    string
  >;

  if (isLoading || !data) return null;

  const moduleEntries: Array<{ key: keyof DataQualityReportView['modules']; label: string }> = [
    { key: 'bankTransactions', label: dq.moduleBankTransactions },
    { key: 'receivables', label: dq.moduleReceivables },
    { key: 'payables', label: dq.modulePayables },
    { key: 'budgetActuals', label: dq.moduleBudgetActuals },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">{dq.title}</CardTitle>
        <Badge variant={scoreVariant(data.score)}>{dq.scoreLabel.replace('{score}', String(data.score))}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {moduleEntries.map(({ key, label }) => {
          const module = data.modules[key];
          const Icon = STATUS_ICON[module.status];
          return (
            <div key={key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{label}</p>
                <Badge variant={STATUS_BADGE_VARIANT[module.status]} className="mt-0.5">
                  {dq[`status_${module.status}`] ?? module.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
