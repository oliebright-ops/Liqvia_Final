export interface FormatCurrencyOptions {
  /** Decimal places (default 0 for whole currency units). */
  decimals?: number;
  /** Compact K/M notation for large values. */
  compact?: boolean;
  /** Include explicit + sign for positive values. */
  signed?: boolean;
}

/** Shared currency formatter — single source for decimal and sign handling. */
export function formatCurrency(
  value: number | null | undefined,
  currencyCode: string,
  options: FormatCurrencyOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  const { decimals = 0, compact = false, signed = false } = options;

  if (compact) {
    return formatCompact(value, currencyCode, signed);
  }

  const formatted = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode || 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  if (value < 0) return `−${formatted}`;
  if (signed && value > 0) return `+${formatted}`;
  return formatted;
}

function formatCompact(value: number, currencyCode: string, signed: boolean): string {
  const sym = currencySymbol(currencyCode);
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  if (abs >= 1_000_000) {
    return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${sym}${Math.round(abs / 1_000)}K`;
  }
  return `${sign}${sym}${abs.toLocaleString('en', { maximumFractionDigits: 0 })}`;
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case 'GBP':
      return '£';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'RUB':
      return '₽';
    default:
      return `${currency} `;
  }
}

/** Format a percentage change with sign, e.g. +4.2% */
export function formatPercentChange(pct: number | null | undefined): string | undefined {
  if (pct === null || pct === undefined) return undefined;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
