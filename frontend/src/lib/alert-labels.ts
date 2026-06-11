import { formatCurrency } from '@liqvia2/shared';
import type { DashboardAlert } from './dashboard-types';
import { TranslateFn } from './i18n';
import { liquidityLabel } from './liquidity-labels';

export function alertSeverityLabel(format: TranslateFn, severity: string): string {
  const key = `dashboard.alertSeverity.${severity}`;
  const translated = format(key);
  return translated === key ? severity : translated;
}

function parseAmountFromMessage(message: string): number | undefined {
  const patterns = [
    /\((?:RUB|USD|EUR|GBP|₽|\$|€)\s*([\d,]+(?:\.\d+)?)\)/i,
    /\b(?:RUB|USD|EUR|GBP|₽|\$|€)\s*([\d,]+(?:\.\d+)?)/i,
    /total\s+((?:RUB|USD|EUR|GBP)\s*[\d,]+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;
    const raw = match[1].replace(/[^\d.-]/g, '');
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function resolveAlertParams(alert: DashboardAlert): DashboardAlert['params'] | undefined {
  if (alert.params && Object.keys(alert.params).length > 0) {
    return alert.params;
  }

  const amount = parseAmountFromMessage(alert.message);

  switch (alert.alertType) {
    case 'delayed_collection':
    case 'upcoming_obligation':
      return amount !== undefined ? { amount } : undefined;
    case 'runway': {
      const weeksMatch = alert.message.match(/([\d.]+)\s*weeks?/i);
      return weeksMatch ? { weeks: parseFloat(weeksMatch[1]) } : undefined;
    }
    case 'negative_cash': {
      const weekMatch = alert.message.match(/week\s+(\d+)/i);
      const closing = /closing cash is negative/i.test(alert.message);
      if (amount === undefined && !weekMatch) return undefined;
      return {
        amount,
        weekIndex: weekMatch ? Number(weekMatch[1]) : alert.weekIndex ?? undefined,
        closing,
      };
    }
    case 'liquidity_stress': {
      const statusMatch = alert.message.match(
        /liquidity status is\s+(healthy|moderate|high[_ ]risk|critical)/i,
      );
      if (!statusMatch) return undefined;
      return { status: statusMatch[1].toLowerCase().replace(' ', '_') };
    }
    default:
      return undefined;
  }
}

export function formatAlertMessage(
  format: TranslateFn,
  alert: DashboardAlert,
  currency: string,
): string {
  const params = resolveAlertParams(alert);
  if (!params) return alert.message;

  const fmtAmount = (amount: number) => formatCurrency(amount, currency);

  switch (alert.alertType) {
    case 'negative_cash': {
      if (params.amount === undefined) return alert.message;
      const week = String(params.weekIndex ?? alert.weekIndex ?? '');
      const key = params.closing
        ? 'dashboard.alertMessages.negative_cash_closing'
        : 'dashboard.alertMessages.negative_cash';
      return format(key, { amount: fmtAmount(params.amount), week });
    }
    case 'liquidity_stress': {
      if (!params.status) return alert.message;
      return format('dashboard.alertMessages.liquidity_stress', {
        status: liquidityLabel(format, params.status),
      });
    }
    case 'runway': {
      if (params.weeks === undefined) return alert.message;
      return format('dashboard.alertMessages.runway', { weeks: params.weeks.toFixed(1) });
    }
    case 'delayed_collection': {
      if (params.amount === undefined) return alert.message;
      return format('dashboard.alertMessages.delayed_collection', {
        amount: fmtAmount(params.amount),
      });
    }
    case 'upcoming_obligation': {
      if (params.amount === undefined) return alert.message;
      return format('dashboard.alertMessages.upcoming_obligation', {
        amount: fmtAmount(params.amount),
      });
    }
    case 'free_cash_risk': {
      if (params.amount === undefined || params.horizonWeeks === undefined) {
        return alert.message;
      }
      const key =
        params.kind === 'negative'
          ? 'dashboard.alertMessages.free_cash_negative'
          : 'dashboard.alertMessages.free_cash_low';
      return format(key, {
        amount: fmtAmount(params.amount),
        horizon: String(params.horizonWeeks),
      });
    }
    default:
      return alert.message;
  }
}
