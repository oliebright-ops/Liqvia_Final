'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from '@/lib/i18n';
import { needsOnboarding } from '@/lib/auth-types';

export function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && needsOnboarding(user)) {
      router.replace('/onboarding');
    }
  }, [loading, user, router]);

  if (loading) {
    return <p className="text-slate-500">{t('common.loading')}</p>;
  }
  if (!user || needsOnboarding(user)) return null;
  return <>{children}</>;
}
