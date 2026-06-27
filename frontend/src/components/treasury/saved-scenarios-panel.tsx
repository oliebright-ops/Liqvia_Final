'use client';

import type { ScenarioVariables } from '@liqvia2/shared';
import { formatMoney } from '@/lib/dashboard-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n';

export type SavedScenarioSummary = {
  id: string;
  name: string;
  createdAt: string;
  variables: ScenarioVariables;
  week13ClosingCash: number | null;
  deltaWeek13ClosingCash: number | null;
};

export function SavedScenariosPanel({
  scenarios,
  currency,
  pinnedIds,
  loadingId,
  onLoad,
  onTogglePin,
  onRefresh,
}: {
  scenarios: SavedScenarioSummary[];
  currency: string;
  pinnedIds: string[];
  loadingId: string | null;
  onLoad: (scenario: SavedScenarioSummary) => void;
  onTogglePin: (id: string) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{t('scenario.saved.title')}</CardTitle>
            <CardDescription>{t('scenario.saved.subtitle')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="px-3 py-1.5 text-xs"
            onClick={onRefresh}
          >
            {t('scenario.saved.refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {scenarios.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('scenario.saved.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {scenarios.map((s) => {
              const pinned = pinnedIds.includes(s.id);
              const pinDisabled = !pinned && pinnedIds.length >= 2;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                      {' · '}
                      {t('scenario.saved.varsSummary', {
                        revenue: String(s.variables.revenueDeclinePercent),
                        growth: String(s.variables.revenueGrowthPercent),
                        delay: String(s.variables.receivableDelayDays),
                        apDelay: String(s.variables.payableDelayDays),
                        payroll: String(s.variables.payrollIncreasePercent),
                        expense: String(s.variables.expenseGrowthPercent),
                      })}
                    </p>
                    {s.deltaWeek13ClosingCash !== null && (
                      <p
                        className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                          s.deltaWeek13ClosingCash < 0 ? 'text-cash-negative' : 'text-foreground'
                        }`}
                      >
                        {t('scenario.saved.deltaW13')}:{' '}
                        {formatMoney(currency, s.deltaWeek13ClosingCash)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="px-3 py-1.5 text-xs"
                      disabled={loadingId === s.id}
                      onClick={() => onLoad(s)}
                    >
                      {loadingId === s.id ? t('scenario.running') : t('scenario.saved.load')}
                    </Button>
                    <Button
                      type="button"
                      variant={pinned ? 'primary' : 'outline'}
                      className="px-3 py-1.5 text-xs"
                      disabled={pinDisabled}
                      title={
                        pinDisabled ? t('scenario.saved.pinLimit') : t('scenario.saved.pinHint')
                      }
                      onClick={() => onTogglePin(s.id)}
                    >
                      {pinned ? t('scenario.saved.unpin') : t('scenario.saved.pin')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
