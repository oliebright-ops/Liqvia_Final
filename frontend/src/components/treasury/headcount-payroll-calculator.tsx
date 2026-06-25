'use client';

import { useMemo } from 'react';
import {
  estimateAnnualPayrollFromBudgetLines,
  payrollIncreaseFromHires,
} from '@liqvia2/shared';
import type { SummaryReport } from '@liqvia2/shared';
import { useTranslations } from '@/lib/i18n';

export function HeadcountPayrollCalculator({
  data,
  hires,
  annualSalary,
  teamSize,
  onHiresChange,
  onSalaryChange,
  onTeamSizeChange,
  onApplyPercent,
}: {
  data: SummaryReport;
  hires: number;
  annualSalary: number;
  teamSize: number;
  onHiresChange: (value: number) => void;
  onSalaryChange: (value: number) => void;
  onTeamSizeChange: (value: number) => void;
  onApplyPercent: (percent: number) => void;
}) {
  const t = useTranslations();
  const calcTitle = t('scenario.headcountCalc.title');
  const calcSubtitle = t('scenario.headcountCalc.subtitle');
  const calcHires = t('scenario.headcountCalc.hires');
  const calcSalary = t('scenario.headcountCalc.salary');
  const calcTeamSize = t('scenario.headcountCalc.teamSize');
  const calcUsingPayroll = t('scenario.headcountCalc.usingPayrollData');
  const calcUsingTeam = t('scenario.headcountCalc.usingTeamSize');
  const calcResultLabel = t('scenario.headcountCalc.resultLabel');
  const calcApply = t('scenario.headcountCalc.apply');

  const estimatedPayroll = useMemo(
    () => estimateAnnualPayrollFromBudgetLines(data.budgetVsActual.lines, data.asOfDate),
    [data.asOfDate, data.budgetVsActual.lines],
  );

  const computedPercent = payrollIncreaseFromHires({
    hires,
    annualSalaryPerHire: annualSalary,
    currentAnnualPayroll: estimatedPayroll ?? undefined,
    currentTeamSize: estimatedPayroll ? undefined : teamSize,
  });

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <p className="text-xs font-medium text-foreground">{calcTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{calcSubtitle}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-medium text-muted-foreground">{calcHires}</span>
          <input
            type="number"
            min={0}
            max={50}
            value={hires}
            onChange={(e) => onHiresChange(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm tabular-nums"
          />
        </label>
        <label className="block text-xs">
          <span className="font-medium text-muted-foreground">{calcSalary}</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={annualSalary}
            onChange={(e) => onSalaryChange(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm tabular-nums"
          />
        </label>
        <label className="block text-xs">
          <span className="font-medium text-muted-foreground">{calcTeamSize}</span>
          <input
            type="number"
            min={1}
            value={teamSize}
            disabled={!!estimatedPayroll}
            onChange={(e) => onTeamSizeChange(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm tabular-nums disabled:opacity-60"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {estimatedPayroll
          ? calcUsingPayroll.replace(
              '{amount}',
              new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: data.currency,
                maximumFractionDigits: 0,
              }).format(estimatedPayroll),
            )
          : calcUsingTeam.replace('{size}', String(teamSize))}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">{calcResultLabel}</span>{' '}
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {computedPercent}%
          </span>
        </p>
        <button
          type="button"
          onClick={() => onApplyPercent(computedPercent)}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          {calcApply}
        </button>
      </div>
    </div>
  );
}
