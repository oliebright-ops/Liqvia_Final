'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  BANK_SOURCE_FORMATS,
  UPLOAD_FILE_ACCEPT,
  UPLOAD_TEMPLATES,
  type BankSourceFormat,
  type UploadValidationResult,
} from '@liqvia2/shared';
import { apiPost, apiUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { notifyWorkspaceRefresh } from '@/lib/workspace-refresh';
import { useTranslations } from '@/lib/i18n';
import { useDashboard } from '@/hooks/use-dashboard';
import { PageHeader } from '@/components/treasury/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AiNormalizeResponse = {
  detectedFormat: BankSourceFormat;
  signConvention: string;
  mapping: Record<string, string | undefined>;
  confidence: 'high' | 'medium' | 'low';
  source: 'rules' | 'ai';
  warnings: string[];
  skippedRows: number;
  rowCount: number;
  previewRows: Record<string, unknown>[];
  validation: UploadValidationResult & { summary?: string };
  canonicalCsv: string;
  model?: string;
};

const SOURCE_LABELS: Record<BankSourceFormat, string> = {
  auto: 'Auto-detect',
  xero: 'Xero',
  onec: '1C',
  paycom: 'pay.com',
  sap: 'SAP',
  oracle: 'Oracle',
  cba: 'CBA / CommBank',
  amex: 'Amex',
  generic: 'Generic / other',
};

export function AiUploadCenter() {
  const t = useTranslations();
  const { can } = useAuth();
  const { data: dashboard } = useDashboard();
  const canUpload = can('uploads:write');

  const [sourceHint, setSourceHint] = useState<BankSourceFormat>('auto');
  const [defaultAccountName, setDefaultAccountName] = useState('');
  const [defaultAccountMasked, setDefaultAccountMasked] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [normalizing, setNormalizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiNormalizeResponse | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const currency = dashboard?.currency ?? 'USD';
  const headers = UPLOAD_TEMPLATES.bank_transactions.headers;

  const onFile = useCallback(
    async (file: File) => {
      if (!canUpload) return;
      setError(null);
      setImportMessage(null);
      setNormalizing(true);
      setFileName(file.name);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('sourceHint', sourceHint);
        if (defaultAccountName.trim()) form.append('defaultBankAccountName', defaultAccountName.trim());
        if (defaultAccountMasked.trim()) form.append('defaultAccountMasked', defaultAccountMasked.trim());
        form.append('companyCurrency', currency);

        const res = await fetch(apiUrl('/uploads/ai/normalize/file'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getAccessToken() ?? ''}`,
          },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : t('upload.ai.failed'));
        }
        setResult(data as AiNormalizeResponse);
      } catch (e) {
        setResult(null);
        setError(e instanceof Error ? e.message : t('upload.ai.failed'));
      } finally {
        setNormalizing(false);
      }
    },
    [canUpload, sourceHint, defaultAccountName, defaultAccountMasked, currency, t],
  );

  async function confirmImport() {
    if (!result?.validation.valid || !result.canonicalCsv) return;
    setImporting(true);
    setError(null);
    try {
      const summary = await apiPost<{ rowCount: number; batchId: string }>('/uploads/ai/import', {
        canonicalCsv: result.canonicalCsv,
        fileName: fileName ? `ai-${fileName}` : 'ai-bank-transactions.csv',
        companyCurrency: currency,
      });
      setImportMessage(t('upload.ai.importSuccess', { count: String(summary.rowCount) }));
      notifyWorkspaceRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('upload.ai.importFailed'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('upload.ai.title')} subtitle={t('upload.ai.subtitle')} />

      <p className="text-sm text-muted-foreground">
        {t('upload.ai.signConventionNote')}{' '}
        <Link href="/uploads" className="text-primary underline-offset-2 hover:underline">
          {t('upload.ai.standardUploadLink')}
        </Link>
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.ai.uploadTitle')}</CardTitle>
          <CardDescription>{t('upload.ai.uploadHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{t('upload.ai.sourceHint')}</span>
              <select
                value={sourceHint}
                onChange={(e) => setSourceHint(e.target.value as BankSourceFormat)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {BANK_SOURCE_FORMATS.map((id) => (
                  <option key={id} value={id}>
                    {SOURCE_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{t('upload.ai.defaultAccount')}</span>
              <input
                type="text"
                value={defaultAccountName}
                onChange={(e) => setDefaultAccountName(e.target.value)}
                placeholder={t('upload.ai.defaultAccountPlaceholder')}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{t('upload.ai.defaultMasked')}</span>
              <input
                type="text"
                value={defaultAccountMasked}
                onChange={(e) => setDefaultAccountMasked(e.target.value)}
                placeholder="****1234"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          {canUpload ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center hover:border-primary/50">
              <span className="text-sm font-medium text-foreground">{t('upload.dropzone')}</span>
              <span className="mt-1 text-xs text-muted-foreground">{t('upload.fileFormats')}</span>
              <input
                type="file"
                accept={UPLOAD_FILE_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">{t('upload.readOnly')}</p>
          )}

          {normalizing && <p className="text-sm text-muted-foreground">{t('upload.ai.normalizing')}</p>}
          {error && <Alert variant="error">{error}</Alert>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{t('upload.ai.resultTitle')}</CardTitle>
                <Badge variant={result.confidence === 'high' ? 'success' : 'default'}>
                  {result.confidence}
                </Badge>
                <Badge variant="muted">{SOURCE_LABELS[result.detectedFormat] ?? result.detectedFormat}</Badge>
                <Badge variant="muted">{result.source === 'ai' ? t('upload.ai.sourceAi') : t('upload.ai.sourceRules')}</Badge>
              </div>
              <CardDescription>
                {t('upload.ai.resultHint', {
                  mapped: String(result.rowCount),
                  skipped: String(result.skippedRows),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.warnings.length > 0 && (
                <ul className="space-y-1 rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground">{t('upload.ai.mappingTitle')}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(result.mapping)
                    .filter(([, v]) => v)
                    .map(([field, column]) => (
                      <div key={field} className="rounded border border-border/60 px-2 py-1.5 text-xs">
                        <dt className="text-muted-foreground">{field}</dt>
                        <dd className="font-mono text-foreground">{column}</dd>
                      </div>
                    ))}
                </dl>
              </div>

              <p className="text-xs text-muted-foreground">
                {t('upload.ai.signConvention')}: <span className="font-mono">{result.signConvention}</span>
                {result.model ? ` · ${result.model}` : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('upload.previewTitle')}</CardTitle>
              <CardDescription>
                {result.validation.valid
                  ? t('upload.previewHint', {
                      shown: String(Math.min(result.previewRows.length, 50)),
                      total: String(result.rowCount),
                    })
                  : result.validation.summary ?? t('upload.ai.validationFailed')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result.validation.valid && result.validation.errors.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 pr-3">{t('upload.colRow')}</th>
                        <th className="pb-2 pr-3">{t('upload.colColumn')}</th>
                        <th className="pb-2">{t('upload.colMessage')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.validation.errors.slice(0, 20).map((err, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="py-2 pr-3">{err.row ?? '—'}</td>
                          <td className="py-2 pr-3">{err.column}</td>
                          <td className="py-2">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.previewRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {headers.map((h) => (
                          <th key={h} className="pb-2 pr-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.previewRows.slice(0, 15).map((row, i) => (
                        <tr key={i} className="border-b border-border/60">
                          {headers.map((h) => (
                            <td key={h} className="py-2 pr-3 font-mono tabular-nums">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {canUpload && result.validation.valid && (
                <Button onClick={() => void confirmImport()} disabled={importing}>
                  {importing ? t('upload.importing') : t('upload.ai.confirmImport')}
                </Button>
              )}
              {importMessage && <Alert variant="success">{importMessage}</Alert>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
