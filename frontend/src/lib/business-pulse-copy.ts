import { formatCurrency } from '@liqvia2/shared';
import type { TranslateFn } from './i18n';
import type { BusinessPulseItemView, PulseSeverity } from './module-types';

const NS = 'modules.businessPulse';

/**
 * `format()` returns the raw key unchanged when a translation is missing (see
 * lookup() in i18n.tsx) — that's exactly the "businessPulse.overdueTitle" leak this
 * function exists to prevent. If the lookup didn't resolve, fall back to the English
 * copy below (interpolated the same way) instead of ever showing a raw key.
 */
export function t(format: TranslateFn, key: string, fallback: string, params?: Record<string, string>): string {
  const resolved = format(key, params);
  if (resolved !== key) return resolved;
  let text = fallback;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

const PRIORITY_FALLBACK: Record<PulseSeverity, string> = {
  critical: 'Immediate action',
  warning: 'This week',
  info: 'Monitor',
};

export function businessPulsePriorityLabel(format: TranslateFn, severity: PulseSeverity): string {
  return t(format, `${NS}.priority_${severity}`, PRIORITY_FALLBACK[severity]);
}

export interface BusinessPulseItemCopy {
  title: string;
  message: string;
  action: string;
}

/** Builds the localized title/message/recommended-action for an item — the backend
 * only sends structured data (name/amount/dates/etc.), the wording lives here. */
export function describeBusinessPulseItem(
  item: BusinessPulseItemView,
  format: TranslateFn,
): BusinessPulseItemCopy {
  const fmt = (n: number) => formatCurrency(n, item.currency);

  switch (item.category) {
    case 'overdue_payable': {
      const days = String(item.daysOverdue ?? 0);
      const date = item.dueDate ?? '';
      if (item.isPayrollPriority) {
        return {
          title: t(format, `${NS}.payrollOverdueTitle`, 'Payroll payment is overdue'),
          message: t(
            format,
            `${NS}.payrollOverdueMessage`,
            '{name}: {amount} is overdue by {days} day(s) (due {date}). This should usually be treated as the highest payment priority.',
            { name: item.name, amount: fmt(item.amount), days, date },
          ),
          action: t(
            format,
            `${NS}.payrollOverdueAction`,
            'Process payroll immediately, or communicate clearly with employees if there is a delay.',
          ),
        };
      }
      return {
        title: t(format, `${NS}.supplierOverdueTitle`, 'Supplier payments are overdue'),
        message: t(
          format,
          `${NS}.supplierOverdueMessage`,
          '{name}: {amount} is overdue by {days} day(s) (due {date}). Further delays may affect supplier relationships, future deliveries, or service continuity.',
          { name: item.name, amount: fmt(item.amount), days, date },
        ),
        action: t(
          format,
          `${NS}.supplierOverdueAction`,
          'Prioritise critical suppliers first and defer non-essential payments where possible.',
        ),
      };
    }
    case 'overdue_receivable': {
      const days = String(item.daysOverdue ?? 0);
      const date = item.dueDate ?? '';
      return {
        title: t(format, `${NS}.collectTitle`, 'Follow up overdue customers'),
        message: t(
          format,
          `${NS}.collectMessage`,
          '{name}: {amount} is overdue by {days} day(s) (due {date}). Collecting this could improve cash flow without reducing business activity.',
          { name: item.name, amount: fmt(item.amount), days, date },
        ),
        action: t(format, `${NS}.collectAction`, 'Contact {name} and confirm an expected payment date.', {
          name: item.name,
        }),
      };
    }
    case 'obligation_due': {
      const days = item.daysUntilDue ?? 0;
      const isToday = days <= 0;
      const date = item.dueDate ?? '';
      return {
        title: isToday
          ? t(format, `${NS}.obligationDueTodayTitle`, '{name} payment due today', { name: item.name })
          : t(format, `${NS}.obligationDueTitle`, '{name} payment due soon', { name: item.name }),
        message: isToday
          ? t(
              format,
              `${NS}.obligationDueTodayMessage`,
              '{amount} is due today ({date}). Missing this could disrupt operations or incur penalties.',
              { amount: fmt(item.amount), date },
            )
          : t(
              format,
              `${NS}.obligationDueMessage`,
              '{amount} is due in {days} day(s) ({date}). Missing this could disrupt operations or incur penalties.',
              { amount: fmt(item.amount), days: String(days), date },
            ),
        action: t(
          format,
          `${NS}.obligationDueAction`,
          'Make sure funds are set aside to cover this payment on time.',
        ),
      };
    }
    case 'expected_receipt': {
      const days = String(item.daysUntilDue ?? 0);
      const date = item.dueDate ?? '';
      return {
        title: t(format, `${NS}.expectingTitle`, 'Payment expected from {name}', { name: item.name }),
        message: t(
          format,
          `${NS}.expectingMessage`,
          '{amount} is expected in {days} day(s) (due {date}), which should support your cash position.',
          { amount: fmt(item.amount), days, date },
        ),
        action: t(
          format,
          `${NS}.expectingAction`,
          'No action needed — this is a positive signal, not a risk.',
        ),
      };
    }
    case 'cash_buffer': {
      if (item.severity === 'critical') {
        return {
          title: t(format, `${NS}.noBufferTitle`, 'Known outflows exceed available cash'),
          message: t(
            format,
            `${NS}.noBufferMessage`,
            'Based on current cash and expected obligations, free available cash is {amount} — the business may not have enough after planned payments.',
            { amount: fmt(item.amount) },
          ),
          action: t(
            format,
            `${NS}.noBufferAction`,
            'Review upcoming payments, delay non-essential spending, and accelerate customer collections.',
          ),
        };
      }
      return {
        title: t(format, `${NS}.thinBufferTitle`, 'Cash buffer is too low'),
        message: t(
          format,
          `${NS}.thinBufferMessage`,
          'After expected obligations, the business has {amount} of cash cushion left, covering about {weeks} week(s). Unexpected expenses could create cash pressure.',
          { amount: fmt(item.amount), weeks: (item.runwayWeeks ?? 0).toFixed(1) },
        ),
        action: t(
          format,
          `${NS}.thinBufferAction`,
          'Delay discretionary spending until the cash buffer improves.',
        ),
      };
    }
    case 'forecast_shortfall':
      return {
        title: t(format, `${NS}.forecastShortfallTitle`, 'Cash shortfall expected in forecast period'),
        message: t(
          format,
          `${NS}.forecastShortfallMessage`,
          'The forecast shows cash may fall to {amount} in week {week} (around {date}), below a safe level.',
          { amount: fmt(item.amount), week: String(item.weekIndex ?? 0), date: item.dueDate ?? '' },
        ),
        action: t(
          format,
          `${NS}.forecastShortfallAction`,
          'Identify the week of pressure and adjust payments, collections, or spending before then.',
        ),
      };
    case 'stale_bank_data':
      return {
        title: t(format, `${NS}.staleBankTitle`, 'Bank data may be outdated'),
        message: t(
          format,
          `${NS}.staleBankMessage`,
          "Recent bank transactions haven't been updated in {days} day(s), which can reduce forecast accuracy.",
          { days: String(item.daysSinceUpdate ?? 0) },
        ),
        action: t(
          format,
          `${NS}.staleBankAction`,
          'Upload or refresh bank transactions before relying on the forecast.',
        ),
      };
    case 'payroll_risk':
      return {
        title: t(format, `${NS}.payrollRiskTitle`, 'Payroll may not be fully covered'),
        message: t(
          format,
          `${NS}.payrollRiskMessage`,
          'Based on current available cash and expected payroll, the business may not have enough cash set aside for the next payroll run.',
        ),
        action: t(
          format,
          `${NS}.payrollRiskAction`,
          'Transfer funds into the payroll account or delay non-essential payments before payroll is due.',
        ),
      };
    case 'direct_debit_pressure':
      return {
        title: t(format, `${NS}.directDebitPressureTitle`, 'Upcoming direct debits may reduce cash buffer'),
        message: t(
          format,
          `${NS}.directDebitPressureMessage`,
          'Several fixed payments are due soon and may reduce available operating cash.',
        ),
        action: t(
          format,
          `${NS}.directDebitPressureAction`,
          'Review upcoming direct debits and make sure the linked accounts have enough funds.',
        ),
      };
    case 'settlement_delay':
      return {
        title: t(format, `${NS}.settlementDelayTitle`, 'Expected settlement has not arrived'),
        message: t(
          format,
          `${NS}.settlementDelayMessage`,
          'An expected funding or payment processor settlement has not been matched to recent bank transactions.',
        ),
        action: t(
          format,
          `${NS}.settlementDelayAction`,
          'Check the payment platform or government portal and confirm the expected payment date.',
        ),
      };
    case 'cash_in_settlement_accounts':
      return {
        title: t(format, `${NS}.cashInSettlementTitle`, 'Cash may be sitting in settlement accounts'),
        message: t(
          format,
          `${NS}.cashInSettlementMessage`,
          'Some cash appears to be held in merchant, Amex, NDIS, or settlement accounts rather than the main operating account.',
        ),
        action: t(
          format,
          `${NS}.cashInSettlementAction`,
          'Consider transferring surplus funds into the operating or payroll account.',
        ),
      };
    case 'low_operating_cash':
      return {
        title: t(format, `${NS}.lowOperatingCashTitle`, 'Operating cash is running low'),
        message: t(
          format,
          `${NS}.lowOperatingCashMessage`,
          'The main operating account may not have enough cash to cover near-term expenses, even though total cash across all accounts may look healthy.',
        ),
        action: t(
          format,
          `${NS}.lowOperatingCashAction`,
          'Review balances by account purpose and transfer funds where needed.',
        ),
      };
  }
}
