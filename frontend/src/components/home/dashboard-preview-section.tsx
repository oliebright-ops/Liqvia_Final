'use client';

import { useTranslations } from '@/lib/i18n';

const ANNOTATIONS = [
  { key: 'cashPosition' as const, className: 'left-[4%] top-[11%]' },
  { key: 'cashRunway' as const, className: 'left-[54%] top-[11%]' },
  { key: 'liquidityAlerts' as const, className: 'right-[4%] top-[40%]' },
];

export function DashboardPreviewSection() {
  const t = useTranslations();

  return (
    <section className="mx-auto mt-10 w-full max-w-[960px] px-4">
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          backgroundColor: '#0F1117',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <img
          src="/images/dashboard-preview.png"
          alt={t('home.landing.previewAlt')}
          className="block h-auto w-full"
        />
        {ANNOTATIONS.map(({ key, className }) => (
          <span
            key={key}
            className={`absolute ${className} rounded-full border border-white/10 bg-primary/90 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm`}
          >
            {t(`home.landing.previewBadge.${key}`)}
          </span>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('home.landing.previewCaption')}
      </p>
    </section>
  );
}
