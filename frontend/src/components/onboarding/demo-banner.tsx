'use client';

import { FlaskConical } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';

export function DemoBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const demo = (t.onboarding as Record<string, unknown>).demo as Record<string, string>;

  if (!user?.isDemoMode) return null;

  return (
    <div className="mb-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
      <div className="text-sm">
        <p className="font-medium text-amber-100">{demo.bannerTitle}</p>
        <p className="mt-0.5 text-amber-200/80">{demo.bannerHint}</p>
      </div>
    </div>
  );
}
