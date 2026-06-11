import { isApiNetworkError } from './api';
import type { TranslateFn } from './i18n';

export function formatApiError(format: TranslateFn, err: unknown, fallback: string): string {
  if (isApiNetworkError(err)) {
    const translated = format('errors.apiUnreachable');
    return translated === 'errors.apiUnreachable' ? fallback : translated;
  }
  return err instanceof Error ? err.message : fallback;
}
