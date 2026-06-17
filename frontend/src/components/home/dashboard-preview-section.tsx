'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n';

type AnnotationSide = 'left' | 'top' | 'right';

const ANNOTATIONS: { key: 'cashPosition' | 'cashRunway' | 'liquidityAlerts'; side: AnnotationSide }[] = [
  { key: 'cashPosition', side: 'left' },
  { key: 'cashRunway', side: 'top' },
  { key: 'liquidityAlerts', side: 'right' },
];

function AnnotationBadge({ label, side }: { label: string; side: AnnotationSide }) {
  const badge = (
    <span className="whitespace-nowrap rounded-full border border-white/10 bg-[#1E2433] px-3 py-1.5 text-xs font-medium text-[#E5E7EB] shadow-md">
      {label}
    </span>
  );

  const line =
    side === 'top' ? (
      <span className="block h-8 w-px bg-[#3B82F6]/70" aria-hidden />
    ) : (
      <span className="block h-px w-10 bg-[#3B82F6]/70" aria-hidden />
    );

  const arrow =
    side === 'top' ? (
      <span
        className="block h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-[#3B82F6]/70"
        aria-hidden
      />
    ) : side === 'left' ? (
      <span
        className="block h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-[#3B82F6]/70"
        aria-hidden
      />
    ) : (
      <span
        className="block h-0 w-0 border-y-[4px] border-r-[6px] border-y-transparent border-r-[#3B82F6]/70"
        aria-hidden
      />
    );

  if (side === 'top') {
    return (
      <div className="flex flex-col items-center">
        {badge}
        {line}
        {arrow}
      </div>
    );
  }

  if (side === 'left') {
    return (
      <div className="flex items-center">
        {badge}
        {line}
        {arrow}
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {arrow}
      {line}
      {badge}
    </div>
  );
}

function DashboardPlaceholder({ alt, message }: { alt: string; message: string }) {
  return (
    <div
      className="flex aspect-[16/9] w-full items-center justify-center rounded-xl"
      style={{ backgroundColor: '#1A1F2E' }}
      role="img"
      aria-label={alt}
    >
      <p className="text-sm font-medium text-[#9CA3AF]">{message}</p>
    </div>
  );
}

export function DashboardPreviewSection() {
  const t = useTranslations();
  const [imageError, setImageError] = useState(false);

  return (
    <section className="mx-auto mt-10 w-full max-w-[960px] px-4">
      <div className="relative px-0 sm:px-16 md:px-20">
        <div className="pointer-events-none absolute left-0 top-[22%] z-10 hidden sm:block">
          <AnnotationBadge label={t('home.landing.previewBadge.cashPosition')} side="left" />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 sm:block">
          <AnnotationBadge label={t('home.landing.previewBadge.cashRunway')} side="top" />
        </div>

        <div className="pointer-events-none absolute right-0 top-[40%] z-10 hidden sm:block">
          <AnnotationBadge label={t('home.landing.previewBadge.liquidityAlerts')} side="right" />
        </div>

        <div className="pt-0 sm:pt-14">
          <div
            className="w-full rounded-xl"
            style={{
              backgroundColor: '#0F1117',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {imageError ? (
              <DashboardPlaceholder
                alt={t('home.landing.previewAlt')}
                message={t('home.landing.previewComingSoon')}
              />
            ) : (
              <img
                src="/images/dashboard-preview.png"
                alt={t('home.landing.previewAlt')}
                className="block h-auto w-full rounded-xl"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:hidden">
          {ANNOTATIONS.map(({ key }) => (
            <li key={key}>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {t(`home.landing.previewBadge.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-center text-[14px]" style={{ color: '#6B7280' }}>
        {t('home.landing.previewCaption')}
      </p>
    </section>
  );
}
