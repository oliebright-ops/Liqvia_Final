'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import type { WhyChangedResponseView } from '@/lib/module-types';

/** Fetched lazily on first request, not on mount — this is an on-demand explanation,
 * not something every dashboard load should pay for. */
export function useWhyChanged() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const companyId = user?.companyId ?? null;
  const [triggered, setTriggered] = useState(false);

  const query = useQuery({
    queryKey: ['why-changed', companyId, locale],
    queryFn: () => apiGet<WhyChangedResponseView>(`/why-changed?locale=${encodeURIComponent(locale)}`),
    enabled: !!companyId && triggered,
  });

  return { ...query, trigger: () => setTriggered(true), triggered };
}
