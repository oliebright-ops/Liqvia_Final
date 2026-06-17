'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n';

const PREVIEW_FEATURES = ['cashPosition', 'cashRunway', 'liquidityAlerts'] as const;

function DashboardPlaceholder({ alt, message }: { alt: string; message: string }) {
  return (
    <div
      className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-[#1A1F2E]"
      role="img"
      aria-label={alt}
    >
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}

export function DashboardPreviewSection() {
  const t = useTranslations();
  const [imageError, setImageError] = useState(false);

  return (
    <section className="mx-auto w-full max-w-[960px] px-4">
      <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
        {PREVIEW_FEATURES.map((key) => (
          <div key={key} className="text-center sm:text-left">
            <h3 className="text-sm font-semibold text-white">
              {t(`home.landing.previewFeatures.${key}.title`)}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              {t(`home.landing.previewFeatures.${key}.description`)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-primary/20 bg-[#0F1117] shadow-[0_28px_70px_rgba(0,0,0,0.45),0_0_40px_rgba(59,130,246,0.06)]">
        {imageError ? (
          <DashboardPlaceholder
            alt={t('home.landing.previewAlt')}
            message={t('home.landing.previewComingSoon')}
          />
        ) : (
          <img
            src="/images/dashboard-preview.png"
            alt={t('home.landing.previewAlt')}
            className="block h-auto w-full rounded-2xl"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">{t('home.landing.previewCaption')}</p>
    </section>
  );
}
