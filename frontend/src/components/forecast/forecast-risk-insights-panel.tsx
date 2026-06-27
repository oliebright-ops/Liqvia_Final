'use client';

import Link from 'next/link';
import type { ForecastDiagnostics, SummaryReport } from '@liqvia2/shared';
import { AP_PAYMENT_PRIORITY_ORDER } from '@liqvia2/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/dashboard-types';
import { useTranslations } from '@/lib/i18n';

export function ForecastRiskInsightsPanel({
  diagnostics,
  currency,
  horizonWeeks,
}: {
  diagnostics: ForecastDiagnostics;
  currency: string;
  horizonWeeks: number;
}) {
  const t = useTranslations();
  const hasOverdueAr = diagnostics.overdueArWeek1 > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{t('forecast.riskInsights.title')}</CardTitle>
          {hasOverdueAr && <Badge variant="warning">{t('forecast.riskInsights.overdueBadge')}</Badge>}
        </div>
        <CardDescription>{t('forecast.riskInsights.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            {t('forecast.riskInsights.arTitle')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('forecast.riskInsights.arBody')}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label={t('forecast.riskInsights.overdueWeek1')}
              value={formatMoney(currency, diagnostics.overdueArWeek1)}
              hint={t('forecast.riskInsights.overdueWeek1Hint', {
                count: String(diagnostics.overdueArInvoiceCount),
              })}
              warn={hasOverdueAr}
            />
            <Metric
              label={t('forecast.riskInsights.scheduledOnDue')}
              value={formatMoney(currency, diagnostics.scheduledArOnDueDate)}
              hint={t('forecast.riskInsights.scheduledOnDueHint')}
            />
            <Metric
              label={t('forecast.riskInsights.weightedExpectation')}
              value={formatMoney(currency, diagnostics.weightedCollectionExpectation)}
              hint={t('forecast.riskInsights.weightedExpectationHint')}
            />
            <Metric
              label={t('forecast.riskInsights.avgOverdueDays')}
              value={
                diagnostics.avgOverdueArDays !== null
                  ? `${diagnostics.avgOverdueArDays}d`
                  : t('forecast.backtest.notAvailable')
              }
              hint={t('forecast.riskInsights.avgOverdueDaysHint')}
            />
          </dl>
          {hasOverdueAr && (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
              {t('forecast.riskInsights.overdueWarning', {
                amount: formatMoney(currency, diagnostics.overdueArWeek1),
              })}
            </p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground">
            {t('forecast.riskInsights.apTitle')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('forecast.riskInsights.apBody')}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t('forecast.riskInsights.colPriority')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('forecast.riskInsights.colOutstanding')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('forecast.riskInsights.colOverdue')}</th>
                  <th className="pb-2 font-medium">
                    {t('forecast.riskInsights.colHorizon', { horizon: String(horizonWeeks) })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {AP_PAYMENT_PRIORITY_ORDER.map((priority) => {
                  const row = diagnostics.apByPriority.find((r) => r.priority === priority);
                  if (!row || row.totalOutstanding <= 0) return null;
                  return (
                    <tr key={priority} className="border-b border-border/60">
                      <td className="py-2 pr-3 capitalize">{t(`forecast.riskInsights.priority.${priority}`)}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {formatMoney(currency, row.totalOutstanding)}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {formatMoney(currency, row.overdueAmount)}
                      </td>
                      <td className="py-2 font-mono tabular-nums">
                        {formatMoney(currency, row.scheduledInHorizon)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('forecast.riskInsights.deferrableSummary', {
              deferrable: formatMoney(currency, diagnostics.apDeferrableTotal),
              essential: formatMoney(currency, diagnostics.apEssentialTotal),
            })}
          </p>
          {diagnostics.week1CashCoverageGap !== null && diagnostics.week1CashCoverageGap < 0 && (
            <p className="mt-2 rounded-md border border-cash-negative/30 bg-cash-negative/10 px-3 py-2 text-xs text-cash-negative">
              {t('forecast.riskInsights.payrollGapWarning', {
                payroll: formatMoney(currency, diagnostics.payrollDueWeek1),
                gap: formatMoney(currency, Math.abs(diagnostics.week1CashCoverageGap)),
              })}
            </p>
          )}
        </section>

        {diagnostics.rollingBurn && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">
              {t('forecast.riskInsights.burnTitle')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('forecast.riskInsights.burnBody', {
                weeks: String(diagnostics.rollingBurn.lookbackWeeks),
              })}
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <Metric
                label={t('forecast.riskInsights.avgInflows')}
                value={formatMoney(currency, diagnostics.rollingBurn.avgWeeklyInflows)}
              />
              <Metric
                label={t('forecast.riskInsights.avgOutflows')}
                value={formatMoney(currency, diagnostics.rollingBurn.avgWeeklyOutflows)}
              />
              <Metric
                label={t('forecast.riskInsights.burnTrend')}
                value={t(`forecast.riskInsights.trend.${diagnostics.rollingBurn.trend}`)}
                hint={t('forecast.riskInsights.burnTrendHint')}
              />
            </dl>
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          {t('forecast.riskInsights.scenarioCta')}{' '}
          <Link href="/scenarios" className="font-medium text-primary hover:underline">
            {t('nav.scenarios')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
          warn ? 'text-amber-400' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
