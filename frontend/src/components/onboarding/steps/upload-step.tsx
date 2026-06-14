'use client';

import { useCallback, useEffect, useState } from 'react';
import { UPLOAD_TEMPLATES, UploadTemplateType, UPLOAD_FILE_ACCEPT, validateUpload } from '@liqvia2/shared';
import { apiGet, apiPost, apiUrl } from '@/lib/api';
import { readUploadFile } from '@/lib/read-upload-file';
import { notifyWorkspaceRefresh } from '@/lib/workspace-refresh';
import { useTranslations } from '@/lib/i18n';
import { OnboardingNav } from '../onboarding-nav';

type UploadBatch = {
  id: string;
  templateType: string;
  fileName: string;
  status: string;
};

const RECOMMENDED: UploadTemplateType[] = [
  'weekly_actuals',
  'prior_period_budget',
  'rolling_budget',
  'trial_balance',
  'bank_balances',
  'bank_transactions',
  'ar_ageing',
  'ap_ageing',
];

export function UploadStep({
  companyCurrency,
  onBack,
  onNext,
}: {
  companyCurrency: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations();
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [activeType, setActiveType] = useState<UploadTemplateType | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    try {
      const data = await apiGet<UploadBatch[]>('/uploads/batches');
      setBatches(data);
    } catch {
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const completedTypes = new Set(
    batches.filter((b) => b.status === 'completed').map((b) => b.templateType),
  );

  async function onFileSelected(type: UploadTemplateType, file: File) {
    setActiveType(type);
    setImporting(true);
    setMessage(null);
    try {
      const csvContent = await readUploadFile(file);
      const validation = validateUpload(type, csvContent, { companyCurrency });
      if (!validation.valid) {
        setMessage(validation.errors[0]?.message ?? t('onboarding.upload.importError'));
        return;
      }
      const result = await apiPost<{ summary: string }>('/uploads/import', {
        templateType: type,
        csvContent,
        fileName: file.name,
        companyCurrency,
      });
      setMessage(result.summary);
      await loadBatches();
      notifyWorkspaceRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('onboarding.upload.importError'));
    } finally {
      setImporting(false);
      setActiveType(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">{t('onboarding.upload.title')}</h2>
      <p className="mt-2 text-sm text-slate-400">{t('onboarding.upload.subtitle')}</p>
      <p className="mt-1 text-xs text-slate-500">{t('onboarding.upload.skipHint')}</p>

      <ul className="mt-6 space-y-3">
        {RECOMMENDED.map((type) => {
          const meta = UPLOAD_TEMPLATES[type];
          const done = completedTypes.has(type);
          const busy = importing && activeType === type;
          return (
            <li
              key={type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{meta.label}</p>
                <p className="text-xs text-slate-500">
                  {done ? t('onboarding.upload.completed') : t('onboarding.upload.pending')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={apiUrl(`/uploads/templates/${type}/sample`)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500"
                >
                  {t('onboarding.upload.downloadTemplate')}
                </a>
                <label className="cursor-pointer rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600">
                  {busy ? '…' : t('onboarding.upload.uploadFile')}
                  <input
                    type="file"
                    accept={UPLOAD_FILE_ACCEPT}
                    className="sr-only"
                    disabled={importing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onFileSelected(type, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {message && (
        <p
          className={`mt-4 text-sm ${
            message.toLowerCase().includes('imported') ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {message}
        </p>
      )}

      <OnboardingNav onBack={onBack} onNext={onNext} nextLabel={t('onboarding.nav.nextPreview')} />
    </div>
  );
}
