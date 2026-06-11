import { TranslateFn } from './i18n';

export function liquidityLabel(t: TranslateFn, status: string): string {
  const key = `dashboard.liquidityStatus.${status}`;
  const translated = t(key);
  return translated === key ? status.replace(/_/g, ' ') : translated;
}
