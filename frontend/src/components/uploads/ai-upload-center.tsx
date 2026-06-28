'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AI_UPLOAD_TEMPLATE_TYPES,
  BANK_SOURCE_FORMATS,
  AI_UPLOAD_FILE_ACCEPT,
  MAX_AI_UPLOAD_FILES,
  UPLOAD_TEMPLATES,
  type AiUploadTemplateType,
  type BankSourceFormat,
  type UploadValidationResult,
} from '@liqvia2/shared';
import { apiPost, apiUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { notifyWorkspaceRefresh } from '@/lib/workspace-refresh';
import { useTranslations, useLanguage } from '@/lib/i18n';
import { translateUploadValidationErrors } from '@/lib/translate-upload-validation';
import { useDashboard } from '@/hooks/use-dashboard';
import { PageHeader } from '@/components/treasury/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AiUploadFileResult = {
  fileName: string;
  rowCount: number;
  detectedFormat: string;
  confidence: 'high' | 'medium' | 'low';
};

type AiNormalizeResponse = {
  templateType: AiUploadTemplateType;
  detectedFormat: string;
  signConvention?: string;
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
  filesProcessed?: number;
  fileResults?: AiUploadFileResult[];
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

function fileFormatLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.xlsx')) return 'Excel';
  if (lower.endsWith('.xls')) return 'Excel';
  if (lower.endsWith('.csv')) return 'CSV';
  return 'File';
}

function formatLabel(detectedFormat: string, templateType: AiUploadTemplateType): string {
  if (templateType === 'bank_transactions' && detectedFormat in SOURCE_LABELS) {
    return SOURCE_LABELS[detectedFormat as BankSourceFormat];
  }
  return detectedFormat;
}

export function AiUploadCenter() {
  const t = useTranslations();
  const { locale } = useLanguage();
  const { can } = useAuth();
  const { data: dashboard } = useDashboard();
  const canUpload = can('uploads:write');

  const [templateType, setTemplateType] = useState<AiUploadTemplateType>('bank_transactions');
  const [sourceHint, setSourceHint] = useState<BankSourceFormat>('auto');
  const [defaultAccountName, setDefaultAccountName] = useState('');
  const [defaultAccountMasked, setDefaultAccountMasked] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [normalizing, setNormalizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiNormalizeResponse | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const currency = dashboard?.currency ?? 'USD';
  const headers = UPLOAD_TEMPLATES[templateType].headers;
  const isBankTemplate = templateType === 'bank_transactions';
  const templateLabel = UPLOAD_TEMPLATES[templateType].label;

  const importFileLabel = useMemo(() => {
    if (selectedFiles.length === 1) return selectedFiles[0]!.name;
    if (selectedFiles.length > 1) return `ai-batch-${selectedFiles.length}-files.csv`;
    return `ai-${templateType}.csv`;
  }, [selectedFiles, templateType]);

  const resetOnTemplateChange = useCallback((next: AiUploadTemplateType) => {
    setTemplateType(next);
    setSelectedFiles([]);
    setResult(null);
    setImportMessage(null);
    setError(null);
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next = [...incoming];
    setSelectedFiles((current) => {
      const merged = [...current];
      for (const file of next) {
        if (merged.some((existing) => existing.name === file.name && existing.size === file.size)) {
          continue;
        }
        if (merged.length >= MAX_AI_UPLOAD_FILES) break;
        merged.push(file);
      }
      return merged.slice(0, MAX_AI_UPLOAD_FILES);
    });
    setResult(null);
    setImportMessage(null);
    setError(null);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
    setResult(null);
    setImportMessage(null);
  }, []);

  const analyzeFiles = useCallback(async () => {
    if (!canUpload || selectedFiles.length === 0) return;
    setError(null);
    setImportMessage(null);
    setNormalizing(true);
    try {
      const form = new FormData();
      for (const file of selectedFiles) {
        form.append('files', file);
      }
      form.append('templateType', templateType);
      if (isBankTemplate) {
        form.append('sourceHint', sourceHint);
        if (defaultAccountName.trim()) form.append('defaultBankAccountName', defaultAccountName.trim());
        if (defaultAccountMasked.trim()) form.append('defaultAccountMasked', defaultAccountMasked.trim());
      }
      form.append('companyCurrency', currency);

      const res = await fetch(apiUrl('/uploads/ai/normalize/files'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken() ?? ''}`,
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.message === 'string'
            ? data.message
            : Array.isArray(data.message)
              ? data.message.join('; ')
              : t('upload.ai.failed');
        throw new Error(message);
      }
      setResult({
        ...(data as AiNormalizeResponse),
        validation: {
          ...(data as AiNormalizeResponse).validation,
          errors: translateUploadValidationErrors(
            (data as AiNormalizeResponse).validation.errors,
            locale,
          ),
        },
      });
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : t('upload.ai.failed'));
    } finally {
      setNormalizing(false);
    }
  }, [
    canUpload,
    selectedFiles,
    templateType,
    isBankTemplate,
    sourceHint,
    defaultAccountName,
    defaultAccountMasked,
    currency,
    locale,
  ]);

  async function confirmImport() {
    if (!result?.validation.valid || !result.canonicalCsv) return;
    setImporting(true);
    setError(null);
    try {
      const summary = await apiPost<{ rowCount: number; batchId: string }>('/uploads/ai/import', {
        templateType: result.templateType ?? templateType,
        canonicalCsv: result.canonicalCsv,
        fileName: `ai-${importFileLabel.replace(/[^\w.\-]+/g, '-')}`,
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
        {isBankTemplate ? t('upload.ai.signConventionNote') : t('upload.ai.genericNote')}{' '}
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
          <label className="block max-w-md">
            <span className="text-xs font-medium text-muted-foreground">{t('upload.ai.templateType')}</span>
            <select
              value={templateType}
              onChange={(e) => resetOnTemplateChange(e.target.value as AiUploadTemplateType)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {AI_UPLOAD_TEMPLATE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {UPLOAD_TEMPLATES[type].label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(`upload.ai.templateHints.${templateType}` as 'upload.ai.templateHints.bank_transactions')}
            </span>
          </label>

          {isBankTemplate && (
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
          )}

          {canUpload ? (
            <>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center hover:border-primary/50">
                <span className="text-sm font-medium text-foreground">{t('upload.ai.dropzone')}</span>
                <span className="mt-1 text-xs text-muted-foreground">{t('upload.ai.fileFormats')}</span>
                <span className="mt-1 text-xs text-muted-foreground">{t('upload.ai.multiFileHint')}</span>
                <input
                  type="file"
                  multiple
                  accept={AI_UPLOAD_FILE_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>

              {selectedFiles.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('upload.ai.filesSelected', { count: String(selectedFiles.length) })}
                      {' · '}
                      {templateLabel}
                    </p>
                    <Button type="button" onClick={() => void analyzeFiles()} disabled={normalizing}>
                      {normalizing ? t('upload.ai.normalizing') : t('upload.ai.analyzeFiles')}
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fileFormatLabel(file.name)} · {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="shrink-0 text-xs text-red-400 hover:text-red-300"
                        >
                          {t('upload.ai.removeFile')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('upload.readOnly')}</p>
          )}

          {error && <Alert variant="error">{error}</Alert>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{t('upload.ai.resultTitle')}</CardTitle>
                <Badge variant="muted">{UPLOAD_TEMPLATES[result.templateType ?? templateType].label}</Badge>
                <Badge variant={result.confidence === 'high' ? 'success' : 'default'}>
                  {result.confidence}
                </Badge>
                <Badge variant="muted">
                  {formatLabel(result.detectedFormat, result.templateType ?? templateType)}
                </Badge>
                <Badge variant="muted">
                  {result.source === 'ai' ? t('upload.ai.sourceAi') : t('upload.ai.sourceRules')}
                </Badge>
                {(result.filesProcessed ?? 0) > 1 && (
                  <Badge variant="muted">
                    {t('upload.ai.filesMerged', { count: String(result.filesProcessed) })}
                  </Badge>
                )}
              </div>
              <CardDescription>
                {t('upload.ai.resultHint', {
                  mapped: String(result.rowCount),
                  skipped: String(result.skippedRows),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.fileResults && result.fileResults.length > 1 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t('upload.ai.perFileTitle')}</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {result.fileResults.map((file) => (
                      <li
                        key={file.fileName}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-2 py-1"
                      >
                        <span className="truncate">{file.fileName}</span>
                        <span>
                          {file.rowCount} rows ·{' '}
                          {formatLabel(file.detectedFormat, result.templateType ?? templateType)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

              {result.signConvention && (
                <p className="text-xs text-muted-foreground">
                  {t('upload.ai.signConvention')}: <span className="font-mono">{result.signConvention}</span>
                  {result.model ? ` · ${result.model}` : ''}
                </p>
              )}
              {!result.signConvention && result.model && (
                <p className="text-xs text-muted-foreground">{result.model}</p>
              )}
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
