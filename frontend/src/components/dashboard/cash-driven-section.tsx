'use client';

import { formatCurrency } from '@liqvia2/shared';
import { useCashDrivenDashboard } from '@/hooks/use-cash-driven-dashboard';
import { useLanguage } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinancialTable } from '@/components/ui/financial-table';
import type {
  CashByPurposeView,
  PayrollReadinessStatus,
  SettlementStatus,
} from '@/lib/module-types';

const STATUS_BADGE_VARIANT: Record<PayrollReadinessStatus, 'cash-positive' | 'muted' | 'error'> = {
  comfortable: 'cash-positive',
  covered: 'muted',
  shortfall: 'error',
};

const SETTLEMENT_STATUS_BADGE_VARIANT: Record<SettlementStatus, 'cash-positive' | 'muted' | 'warning' | 'error'> = {
  received: 'cash-positive',
  expected: 'muted',
  pending: 'muted',
  delayed: 'error',
  unknown: 'warning',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function CashDrivenSection() {
  const { data, isLoading } = useCashDrivenDashboard(true);
  const { t } = useLanguage();
  const cd = (t.modules as Record<string, Record<string, string>>).cashDriven;

  if (isLoading || !data) return null;

  const currency = data.cashByPurpose.currency;
  const fmt = (n: number) => formatCurrency(n, currency, { compact: true });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{cd.payrollReadinessTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data.payrollReadiness.status ? (
              <p className="text-sm text-muted-foreground">{cd.noPayrollObligation}</p>
            ) : (
              <>
                <Row label={cd.nextPayroll} value={data.payrollReadiness.nextPayrollDate ?? '—'} />
                <Row label={cd.expectedPayroll} value={fmt(data.payrollReadiness.expectedPayrollAmount)} />
                <Row label={cd.availablePayrollCash} value={fmt(data.payrollReadiness.availablePayrollCash)} />
                <Row label={cd.bufferAfterPayroll} value={fmt(data.payrollReadiness.bufferAfterPayroll)} />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{cd.status}</span>
                  <Badge variant={STATUS_BADGE_VARIANT[data.payrollReadiness.status]}>
                    {cd[`status_${data.payrollReadiness.status}`]}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{cd.cashByPurposeTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label={cd.totalCash} value={fmt(data.cashByPurpose.totalCash)} />
            <Row label={cd.operatingCash} value={fmt(byPurpose(data.cashByPurpose, 'operating'))} />
            <Row label={cd.payrollReserve} value={fmt(data.cashByPurpose.payrollReserve)} />
            <Row label={cd.taxReserve} value={fmt(data.cashByPurpose.taxReserve)} />
            <Row label={cd.ndisSettlement} value={fmt(byPurpose(data.cashByPurpose, 'ndis_settlement'))} />
            <Row label={cd.merchantClearing} value={fmt(byPurpose(data.cashByPurpose, 'merchant_clearing'))} />
            <Row label={cd.emergencyReserve} value={fmt(data.cashByPurpose.emergencyReserve)} />
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-sm font-medium text-foreground">{cd.availableToSpend}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {fmt(data.cashByPurpose.availableToSpend)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{cd.availableToSpendHint}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{cd.upcomingObligationsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialTable
            rows={data.upcomingObligations}
            rowKey={(r) => r.obligationId}
            empty={<p className="text-sm text-muted-foreground">{cd.noObligations}</p>}
            columns={[
              { key: 'name', header: cd.col_obligationName, render: (r) => r.name },
              { key: 'category', header: cd.col_category, muted: true, render: (r) => r.category },
              {
                key: 'amount',
                header: cd.col_amount,
                align: 'right',
                mono: true,
                render: (r) => fmt(r.amount),
              },
              { key: 'frequency', header: cd.col_frequency, muted: true, render: (r) => r.frequency },
              { key: 'nextDueDate', header: cd.col_nextDueDate, render: (r) => r.nextDueDate },
              {
                key: 'paymentMethod',
                header: cd.col_paymentMethod,
                muted: true,
                render: (r) => r.paymentMethod ?? '—',
              },
              {
                key: 'linkedAccount',
                header: cd.col_linkedAccount,
                muted: true,
                render: (r) => r.linkedBankAccount ?? '—',
              },
              {
                key: 'confidence',
                header: cd.col_confidence,
                render: (r) => (r.confidence ? cd[`confidence_${r.confidence}`] : '—'),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{cd.settlementTimelineTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialTable
            rows={data.settlementTimeline}
            rowKey={(r) => r.settlementId}
            empty={<p className="text-sm text-muted-foreground">{cd.noSettlements}</p>}
            columns={[
              { key: 'source', header: cd.col_settlementSource, render: (r) => r.source },
              {
                key: 'amount',
                header: cd.col_expectedAmount,
                align: 'right',
                mono: true,
                render: (r) => fmt(r.expectedAmount),
              },
              { key: 'date', header: cd.col_expectedDate, render: (r) => r.expectedDate },
              {
                key: 'destination',
                header: cd.col_destinationAccount,
                muted: true,
                render: (r) => r.destinationAccount ?? '—',
              },
              {
                key: 'status',
                header: cd.col_settlementStatus,
                render: (r) => (
                  <Badge variant={SETTLEMENT_STATUS_BADGE_VARIANT[r.status]} className="text-[10px]">
                    {cd[`settlementStatus_${r.status}`]}
                  </Badge>
                ),
              },
              {
                key: 'confidence',
                header: cd.col_confidence,
                render: (r) => (r.confidence ? cd[`confidence_${r.confidence}`] : '—'),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{cd.weeklyCashMovementTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialTable
            rows={data.weeklyCashMovement}
            rowKey={(r) => String(r.weekIndex)}
            columns={[
              { key: 'week', header: cd.col_week, render: (r) => r.weekStartDate },
              {
                key: 'opening',
                header: cd.col_opening,
                align: 'right',
                mono: true,
                render: (r) => fmt(r.openingCash),
              },
              {
                key: 'incoming',
                header: cd.col_incoming,
                align: 'right',
                mono: true,
                render: (r) => fmt(r.expectedIncoming),
              },
              {
                key: 'outgoing',
                header: cd.col_outgoing,
                align: 'right',
                mono: true,
                render: (r) => fmt(r.expectedOutgoing),
              },
              {
                key: 'net',
                header: cd.col_net,
                align: 'right',
                mono: true,
                render: (r) => (
                  <span className={r.netMovement >= 0 ? 'text-cash-positive' : 'text-cash-negative'}>
                    {formatCurrency(r.netMovement, currency, { compact: true, signed: true })}
                  </span>
                ),
              },
              {
                key: 'closing',
                header: cd.col_closing,
                align: 'right',
                mono: true,
                render: (r) => fmt(r.closingCash),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );

  function byPurpose(cashByPurpose: CashByPurposeView, purpose: string): number {
    return cashByPurpose.byPurpose[purpose as keyof typeof cashByPurpose.byPurpose] ?? 0;
  }
}
