'use client';

import { useState } from 'react';
import {
  getTemplateSampleFileName,
  UPLOAD_LIBRARY_TEMPLATE_TYPES,
  UploadTemplateType,
} from '@liqvia2/shared';
import { downloadAuthenticatedFile } from '@/lib/api';
import { useTranslations } from '@/lib/i18n';
import {
  formatRequiredColumnsFile,
  formatRequiredColumnsUi,
  translateUploadTemplateLabel,
} from '@/lib/upload-template-i18n';

export function templateSampleUrl(type: UploadTemplateType, format: 'csv' | 'xlsx' = 'csv'): string {
  const query = format === 'xlsx' ? '?format=xlsx' : '';
  return `/uploads/templates/${type}/sample${query}`;
}

export async function downloadTemplateSample(
  type: UploadTemplateType,
  format: 'csv' | 'xlsx',
): Promise<void> {
  await downloadAuthenticatedFile(
    templateSampleUrl(type, format),
    getTemplateSampleFileName(type, format),
  );
}

const linkClassName =
  'inline-flex cursor-pointer items-center rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

type UploadTemplateLibraryProps = {
  /** Highlight one type when embedded in the upload flow selector */
  highlightType?: UploadTemplateType;
  compact?: boolean;
};

function TemplateDownloadButton({
  type,
  format,
  label,
}: {
  type: UploadTemplateType;
  format: 'csv' | 'xlsx';
  label: string;
}) {
  const [downloading, setDownloading] = useState(false);

  return (
    <button
      type="button"
      disabled={downloading}
      className={linkClassName}
      onClick={() => {
        setDownloading(true);
        void downloadTemplateSample(type, format)
          .catch(() => undefined)
          .finally(() => setDownloading(false));
      }}
    >
      {downloading ? '…' : label}
    </button>
  );
}

export function UploadTemplateLibrary({ highlightType, compact }: UploadTemplateLibraryProps) {
  const t = useTranslations();

  return (
    <div className={compact ? 'space-y-3' : 'grid gap-4 sm:grid-cols-2'}>
      {UPLOAD_LIBRARY_TEMPLATE_TYPES.map((type) => {
        const highlighted = highlightType === type;
        return (
          <div
            key={type}
            className={`rounded-lg border p-4 ${
              highlighted ? 'border-primary bg-primary/10' : 'border-border bg-card'
            }`}
          >
            <p className="font-medium text-foreground">{translateUploadTemplateLabel(type, t)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('upload.requiredColumns')}: {formatRequiredColumnsUi(type, t)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('upload.requiredColumnsFileHint', { headers: formatRequiredColumnsFile(type) })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <TemplateDownloadButton
                type={type}
                format="csv"
                label={t('upload.downloadTemplateCsv')}
              />
              <TemplateDownloadButton
                type={type}
                format="xlsx"
                label={t('upload.downloadTemplateExcel')}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
