'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import ru from '@/locales/ru.json';

const catalogs = { en, es, fr, ru } as const;

export type Locale = keyof typeof catalogs;

export const SUPPORTED_LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'ru', label: 'Русский', short: 'RU' },
];

/** @deprecated Use SUPPORTED_LOCALES */
export const ONBOARDING_LOCALES = SUPPORTED_LOCALES.map(({ code, short }) => ({
  code,
  label: short,
}));

const STORAGE_KEY = 'liqvia.locale';

export type TranslateFn = (key: string, params?: Record<string, string>) => string;

export function lookup(locale: Locale, key: string): unknown {
  const parts = key.split('.');
  let value: unknown = catalogs[locale] ?? catalogs.en;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function translate(locale: Locale, key: string, params?: Record<string, string>): string {
  let value = lookup(locale, key);
  if (value === undefined && locale !== 'en') {
    value = lookup('en', key);
  }
  if (value === undefined) {
    return key;
  }
  let text = typeof value === 'string' ? value : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

function createNestedT(locale: Locale, prefix = ''): Record<string, unknown> {
  const base = prefix ? lookup(locale, prefix) : catalogs[locale];
  if (!base || typeof base !== 'object') {
    return {};
  }
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        const key = prefix ? `${prefix}.${prop}` : prop;
        const value = lookup(locale, key);
        if (typeof value === 'string') {
          return value;
        }
        if (value && typeof value === 'object') {
          return createNestedT(locale, key);
        }
        if (locale !== 'en') {
          const fallback = lookup('en', key);
          if (typeof fallback === 'string') return fallback;
        }
        return key;
      },
    },
  );
}

export type NestedTranslations = ReturnType<typeof createNestedT> & {
  format: TranslateFn;
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored in catalogs) {
      setLocaleState(stored as Locale);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function useTranslations(): TranslateFn {
  const { locale } = useContext(LocaleContext);
  return useMemo<TranslateFn>(() => (key, params) => translate(locale, key, params), [locale]);
}

/** Primary i18n hook — nested t.dashboard.title + t.format('key', params). */
export function useLanguage() {
  const { locale, setLocale } = useLocale();
  const format = useTranslations();
  const t = useMemo(() => {
    const nested = createNestedT(locale) as NestedTranslations;
    nested.format = format;
    return nested;
  }, [locale, format]);
  return { t, locale, setLocale, format };
}
