import type {
  DashboardTransactionRow,
  SummaryReport,
  WeeklyForecastLine,
} from '@liqvia2/shared';
import { formatCurrency, formatPercentChange } from '@liqvia2/shared';
import type { TranslateFn } from './i18n';

/** Pre-formatted view model — dashboard components render props only, zero calculations. */
export interface DashboardViewModel {
  companyName: string;
  asOfDate: string;
  currency: string;
  totalCashDisplay: string;
  accountCountSubtitle: string;
  reconciliationPending: boolean;
  kpiCards: KpiCardViewModel[];
  forecast: WeeklyForecastLine[];
  liquidityStatus: string;
  alerts: SummaryReport['alerts'];
  recentTransactions: TransactionRowViewModel[];
  companyId: string;
}

export interface KpiCardViewModel {
  key: string;
  label: string;
  value: string;
  subtitle: string;
  hint?: string;
  hintAriaLabel?: string;
  href?: string;
  changeBadge?: string;
  changeLabel?: string;
  badgeStatus?: string;
  negative?: boolean;
  primary?: boolean;
}

const KPI_MODULE_LINKS: Record<string, string> = {
  cashPosition: '/bank-accounts',
  cashRunway: '/forecast',
  freeCash: '/forecast',
  arDue30: '/ledger',
};

export interface TransactionRowViewModel {
  id: string;
  direction: 'IN' | 'OUT';
  description: string;
  categoryLabel: string;
  dateDisplay: string;
  amountDisplay: string;
  statusLabel: string;
  statusVariant: 'cleared' | 'pending';
}

function formatTxnDate(iso: string, locale: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Maps SummaryReport → display-only view model for the executive dashboard. */
export function mapSummaryToDashboardView(
  summary: SummaryReport,
  format: TranslateFn,
  locale: string,
  txnCategoryLabels: Record<string, string>,
  horizonWeeks?: number,
): DashboardViewModel {
  const dash = (key: string, params?: Record<string, string>) => format(`dashboard.${key}`, params);
  const notAvailable = dash('notAvailable');

  const kpiCards = buildKpiCardViews(summary, format, locale, notAvailable, horizonWeeks);

  return {
    companyName: summary.companyName,
    asOfDate: summary.asOfDate,
    currency: summary.currency,
    totalCashDisplay: formatCurrency(summary.cash.total, summary.currency, { compact: true }),
    accountCountSubtitle: dash('acrossBankAccounts', {
      count: String(summary.cash.accountCount),
    }),
    reconciliationPending: !summary.reconciliation.isConsistent,
    kpiCards,
    forecast: summary.forecast,
    liquidityStatus: summary.liquidity.liquidityStatus,
    alerts: summary.alerts,
    recentTransactions: summary.recentTransactions.map((txn) =>
      mapTransactionRow(txn, summary.currency, locale, txnCategoryLabels, format),
    ),
    companyId: summary.companyId,
  };
}

function buildKpiCardViews(
  summary: SummaryReport,
  format: TranslateFn,
  locale: string,
  notAvailable: string,
  horizonWeeks?: number,
): KpiCardViewModel[] {
  const dash = (key: string, params?: Record<string, string>) => format(`dashboard.${key}`, params);
  const { cash, liquidity, risk, kpiCards } = summary;

  const runwayValue =
    liquidity.weeklyBurn <= 0 && liquidity.runwayWeeks === null
      ? dash('infiniteRunway')
      : liquidity.runwayWeeks !== null
        ? `${liquidity.runwayWeeks}w`
        : notAvailable;

  const freeCashSubtitle = dash('freeCashSubtitle', {
    horizon: String(horizonWeeks ?? liquidity.horizonWeeks),
    committed: formatCurrency(liquidity.fixedOutflowsHorizon, summary.currency, {
      compact: true,
    }),
  });

  return [
    {
      key: 'cashPosition',
      href: KPI_MODULE_LINKS.cashPosition,
      label: dash('cashPosition'),
      value: kpiCards.cashPosition.hasData
        ? formatCurrency(cash.total, summary.currency, { compact: true })
        : notAvailable,
      subtitle: kpiCards.cashPosition.hasData
        ? dash('acrossBankAccounts', { count: String(cash.accountCount) })
        : dash('uploadDataPrompt'),
      changeBadge: kpiCards.cashPosition.hasData
        ? formatPercentChange(cash.trend)
        : undefined,
      changeLabel: kpiCards.cashPosition.hasData ? dash('vsLastWeek') : undefined,
      primary: true,
    },
    {
      key: 'cashRunway',
      href: KPI_MODULE_LINKS.cashRunway,
      label: dash('cashRunway'),
      value: kpiCards.cashRunway.hasData ? runwayValue : notAvailable,
      subtitle: kpiCards.cashRunway.hasData
        ? dash('burnPerWeek', {
            amount: formatCurrency(liquidity.weeklyBurn, summary.currency, { compact: true }),
          })
        : dash('uploadDataPrompt'),
      badgeStatus: kpiCards.cashRunway.hasData ? liquidity.liquidityStatus : undefined,
    },
    {
      key: 'freeCash',
      href: KPI_MODULE_LINKS.freeCash,
      label: dash('freeAvailableCash'),
      value: formatCurrency(liquidity.freeAvailableCash, summary.currency, { compact: true }),
      subtitle: freeCashSubtitle,
      hint: dash('freeCashHint', {
        horizon: String(horizonWeeks ?? liquidity.horizonWeeks),
      }),
      hintAriaLabel: dash('freeCashHintAria'),
      negative: liquidity.freeAvailableCash < 0,
      badgeStatus:
        liquidity.freeAvailableCash < 0
          ? 'critical'
          : liquidity.freeAvailableCash < cash.total * 0.1
            ? 'high_risk'
            : 'healthy',
    },
    {
      key: 'arDue30',
      href: KPI_MODULE_LINKS.arDue30,
      label: dash('arDue30Days'),
      value: kpiCards.arDue30Days.hasData
        ? formatCurrency(risk.arDue30, summary.currency, { compact: true })
        : notAvailable,
      subtitle: kpiCards.arDue30Days.hasData
        ? dash('arDelayed90Plus', {
            amount: formatCurrency(risk.arDelayed90, summary.currency, { compact: true }),
          })
        : dash('uploadDataPrompt'),
      changeLabel: kpiCards.arDue30Days.hasData ? dash('collectionModelLabel') : undefined,
    },
  ];
}

function mapTransactionRow(
  txn: DashboardTransactionRow,
  currency: string,
  locale: string,
  txnCategoryLabels: Record<string, string>,
  format: TranslateFn,
): TransactionRowViewModel {
  const amount = formatCurrency(txn.amount, currency);
  return {
    id: txn.id,
    direction: txn.direction,
    description: txn.description,
    categoryLabel: txnCategoryLabels[txn.category] ?? txn.category,
    dateDisplay: formatTxnDate(txn.transactionDate, locale),
    amountDisplay: `${txn.direction === 'IN' ? '+' : '−'}${amount}`,
    statusLabel:
      txn.status === 'cleared'
        ? format('dashboard.txnCleared')
        : format('dashboard.txnPending'),
    statusVariant: txn.status,
  };
}
