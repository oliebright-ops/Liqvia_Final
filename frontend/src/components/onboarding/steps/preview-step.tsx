'use client';

import { useEffect, useState } from 'react';
import { UPLOAD_TEMPLATES, UploadTemplateType } from '@liqvia2/shared';
import { apiGet } from '@/lib/api';
import { fiscalMonthLabel } from '@/lib/onboarding-state';
import { useTranslations } from '@/lib/i18n';
import { OnboardingNav } from '../onboarding-nav';

type PreviewData = {
  company: {
    name: string;
    industry: string | null;
    currency: string;
    fiscalYearStart: number;
    forecastHorizonWeeks: number;
    openingCashBalance: number | null;
  };
  users: Array<{ name: string; email: string; role: string }>;
  uploads: Array<{ templateType: string; fileName: string; status: string }>;
};

export function PreviewStep({
  onBack,
  onFinish,
  finishing,
  error,
}: {
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
  error: string | null;
}) {
  const t = useTranslations();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<PreviewData>('/onboarding/preview')
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-400">{t('common.loading')}</p>;
  }

  if (!preview) {
    return <p className="text-red-400">{t('common.previewLoadFailed')}</p>;
  }

  const { company, users, uploads } = preview;
  const completedUploads = uploads.filter((u) => u.status === 'completed');

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">{t('onboarding.preview.title')}</h2>
      <p className="mt-2 text-sm text-slate-400">{t('onboarding.preview.subtitle')}</p>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t('onboarding.preview.companySection')}
          </h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <PreviewRow label={t('onboarding.company.name')} value={company.name} />
            <PreviewRow label={t('onboarding.company.industry')} value={company.industry ?? '—'} />
            <PreviewRow label={t('onboarding.company.currency')} value={company.currency} />
            <PreviewRow
              label={t('onboarding.company.fiscalYear')}
              value={fiscalMonthLabel(company.fiscalYearStart)}
            />
            <PreviewRow
              label={t('onboarding.company.forecastHorizon')}
              value={`${company.forecastHorizonWeeks} ${t('onboarding.company.weeks')}`}
            />
            <PreviewRow
              label={`${t('onboarding.company.openingCash')} (${company.currency})`}
              value={
                company.openingCashBalance != null
                  ? company.openingCashBalance.toLocaleString()
                  : '—'
              }
            />
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t('onboarding.preview.teamSection', { count: String(users.length) })}
          </h3>
          <ul className="mt-3 space-y-2">
            {users.map((u) => (
              <li
                key={u.email}
                className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"
              >
                <span className="text-slate-200">
                  {u.name} <span className="text-slate-500">({u.email})</span>
                </span>
                <span className="text-xs uppercase text-slate-500">{u.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t('onboarding.preview.uploadsSection', {
              count: String(completedUploads.length),
            })}
          </h3>
          {completedUploads.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t('onboarding.preview.noUploads')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {completedUploads.map((u, i) => (
                <li
                  key={`${u.templateType}-${i}`}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
                >
                  {UPLOAD_TEMPLATES[u.templateType as UploadTemplateType]?.label ??
                    u.templateType}{' '}
                  — {u.fileName}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <OnboardingNav
        onBack={onBack}
        onNext={onFinish}
        nextLabel={
          finishing ? t('onboarding.nav.finishing') : t('onboarding.nav.finish')
        }
        nextLoading={finishing}
      />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-200">{value}</dd>
    </div>
  );
}
