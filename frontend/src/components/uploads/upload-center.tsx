'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  UPLOAD_TEMPLATES,
  UploadTemplateType,
  UploadValidationResult,
  UPLOAD_FILE_ACCEPT,
  validateUpload,
} from '@liqvia2/shared';
import { apiGet, apiPost, apiUrl } from '@/lib/api';
import { readUploadFile } from '@/lib/read-upload-file';
import { useAuth } from '@/lib/auth-context';
import { notifyWorkspaceRefresh } from '@/lib/workspace-refresh';
import { useTranslations } from '@/lib/i18n';
import { useDashboard } from '@/hooks/use-dashboard';
import { PageHeader } from '@/components/treasury/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type UploadBatchSummary = {
  id: string;
  templateType: string;
  fileName: string;
  status: string;
  rowCount: number | null;
  createdAt: string;
  hasSnapshot?: boolean;
};

type UploadBatchDetail = UploadBatchSummary & {
  hasSnapshot: boolean;
  rows: Record<string, unknown>[];
};

type ActiveUploadData = {
  templateType: string;
  rowCount: number;
  headers: string[];
  rows: Record<string, unknown>[];
  source: 'live';
};

type DataViewMode = 'active' | 'snapshot';

const TEMPLATE_TYPES = (Object.keys(UPLOAD_TEMPLATES) as UploadTemplateType[]).filter(
  (t) => t !== 'budget',
);

export function UploadCenter() {
  const t = useTranslations();
  const { isAdmin } = useAuth();
  const { data: dashboard } = useDashboard();
  const [templateType, setTemplateType] = useState<UploadTemplateType>('trial_balance');
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [validation, setValidation] = useState<
    (UploadValidationResult & { summary?: string }) | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [batches, setBatches] = useState<UploadBatchSummary[]>([]);
  const [latestByType, setLatestByType] = useState<UploadBatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<UploadBatchDetail | null>(null);
  const [activeData, setActiveData] = useState<ActiveUploadData | null>(null);
  const [viewMode, setViewMode] = useState<DataViewMode>('active');
  const [viewType, setViewType] = useState<UploadTemplateType>('trial_balance');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeMessage, setWipeMessage] = useState<string | null>(null);

  const template = UPLOAD_TEMPLATES[templateType];
  const currency = dashboard?.currency ?? 'USD';

  const loadBatches = useCallback(async () => {
    try {
      const [all, latest] = await Promise.all([
        apiGet<UploadBatchSummary[]>('/uploads/batches'),
        apiGet<UploadBatchSummary[]>('/uploads/latest'),
      ]);
      setBatches(all);
      setLatestByType(latest);
    } catch {
      setBatches([]);
      setLatestByType([]);
    }
  }, []);

  const fetchActiveData = useCallback(async (type: UploadTemplateType) => {
    try {
      const data = await apiGet<ActiveUploadData>(`/uploads/active/${type}`);
      setActiveData(data);
    } catch {
      setActiveData(null);
    }
  }, []);

  const showActiveView = useCallback((type: UploadTemplateType) => {
    setViewMode('active');
    setViewType(type);
    setSelectedBatchId(null);
    setBatchDetail(null);
  }, []);

  const loadBatchDetail = useCallback(async (batchId: string, type: UploadTemplateType) => {
    setLoadingDetail(true);
    setViewMode('snapshot');
    setSelectedBatchId(batchId);
    setViewType(type);
    try {
      const detail = await apiGet<UploadBatchDetail>(`/uploads/batches/${batchId}`);
      setBatchDetail(detail);
    } catch {
      setBatchDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void fetchActiveData(viewType);
  }, [viewType, fetchActiveData]);

  const asOfDate = new Date().toISOString().slice(0, 10);

  const runValidation = useCallback(
    (content: string) => {
      const result = validateUpload(templateType, content, {
        companyCurrency: currency,
        asOfDate,
      });
      const summary = result.valid
        ? t('upload.validateSuccess', { count: String(result.rowCount) })
        : t('upload.validateErrors', { count: String(result.errors.length) });
      setValidation({ ...result, summary });
    },
    [templateType, currency, t, asOfDate],
  );

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportMessage(null);
    if (!file) return;
    try {
      const text = await readUploadFile(file);
      setFileName(file.name);
      setCsvContent(text);
      runValidation(text);
    } catch (err) {
      setFileName(null);
      setCsvContent(null);
      setValidation(null);
      setImportMessage(err instanceof Error ? err.message : t('upload.unsupportedFile'));
    }
  };

  const onTemplateChange = (type: UploadTemplateType) => {
    setTemplateType(type);
    showActiveView(type);
    setImportMessage(null);
    if (csvContent) {
      const result = validateUpload(type, csvContent, { companyCurrency: currency, asOfDate });
      const summary = result.valid
        ? t('upload.validateSuccess', { count: String(result.rowCount) })
        : t('upload.validateErrors', { count: String(result.errors.length) });
      setValidation({ ...result, summary });
    } else {
      setValidation(null);
    }
  };

  const downloadSample = () => {
    window.open(apiUrl(`/uploads/templates/${templateType}/sample`), '_blank');
  };

  const confirmImport = async () => {
    if (!csvContent || !validation?.valid) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const result = await apiPost<{ summary: string }>('/uploads/import', {
        templateType,
        csvContent,
        fileName: fileName ?? 'upload.csv',
        companyCurrency: currency,
      });
      setImportMessage(result.summary);
      setCsvContent(null);
      setFileName(null);
      setValidation(null);
      await loadBatches();
      await fetchActiveData(templateType);
      notifyWorkspaceRefresh();
    } catch (err) {
      const e = err as Error & { details?: { errors?: { message: string }[] } };
      const detail = e.details?.errors?.[0]?.message;
      setImportMessage(detail ?? e.message);
    } finally {
      setImporting(false);
    }
  };

  const confirmWipe = async () => {
    setWiping(true);
    setWipeMessage(null);
    try {
      const result = await apiPost<{ summary: string }>('/uploads/wipe', {});
      setWipeMessage(result.summary);
      setWipeConfirm(false);
      setBatchDetail(null);
      setSelectedBatchId(null);
      await loadBatches();
      await fetchActiveData(templateType);
      notifyWorkspaceRefresh();
    } catch (err) {
      setWipeMessage((err as Error).message);
    } finally {
      setWiping(false);
    }
  };

  const previewRows = validation?.valid && validation.rows ? validation.rows.slice(0, 10) : [];
  const previewKeys =
    previewRows.length > 0
      ? Object.keys(previewRows[0] as Record<string, unknown>)
      : template.headers;

  const activeKeys =
    activeData?.rows && activeData.rows.length > 0
      ? Object.keys(activeData.rows[0] as Record<string, unknown>)
      : (activeData?.headers ?? UPLOAD_TEMPLATES[viewType]?.headers ?? []);

  const snapshotRows = batchDetail?.rows ?? [];
  const snapshotKeys =
    snapshotRows.length > 0
      ? Object.keys(snapshotRows[0] as Record<string, unknown>)
      : (UPLOAD_TEMPLATES[viewType]?.headers ?? []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={t('upload.title')} subtitle={t('upload.subtitle')} />
        {isAdmin && (
          <div className="flex flex-col items-end gap-2">
            {!wipeConfirm ? (
              <Button type="button" variant="outline" onClick={() => setWipeConfirm(true)}>
                {t('upload.wipeData')}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <span className="text-sm text-red-900">{t('upload.wipeConfirm')}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={wiping}
                  onClick={() => setWipeConfirm(false)}
                >
                  {t('upload.wipeCancel')}
                </Button>
                <Button type="button" disabled={wiping} onClick={confirmWipe}>
                  {wiping ? t('upload.wiping') : t('upload.wipeConfirmAction')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {wipeMessage && (
        <Alert variant={wipeMessage.toLowerCase().includes('cleared') ? 'success' : 'error'}>
          {wipeMessage}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.rollingTitle')}</CardTitle>
          <CardDescription>{t('upload.rollingHint')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>{t('upload.rollingStep1')}</li>
            <li>{t('upload.rollingStep2')}</li>
            <li>{t('upload.rollingStep3')}</li>
            <li>{t('upload.rollingStep4')}</li>
          </ol>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.selectTemplate')}</CardTitle>
            <CardDescription>{t('upload.selectTemplateHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATE_TYPES.map((type) => {
                const meta = UPLOAD_TEMPLATES[type];
                const selected = type === templateType;
                const hasLatest = latestByType.some((b) => b.templateType === type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onTemplateChange(type)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      selected
                        ? 'border-primary bg-primary/15 text-primary shadow-glow-primary'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{meta.label}</span>
                      {hasLatest && viewMode === 'active' && viewType === type && (
                        <Badge variant="success" className="text-[10px]">
                          {t('upload.inUse')}
                        </Badge>
                      )}
                    </div>
                    <span
                      className={`mt-1 block text-xs ${selected ? 'text-primary/80' : 'text-muted-foreground'}`}
                    >
                      {meta.headers.length} {t('upload.columns')}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={downloadSample}>
                {t('upload.downloadTemplate')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('upload.uploadFile')}</CardTitle>
            <CardDescription>
              {t('upload.requiredColumns')}: {template.headers.join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 transition-colors hover:border-primary/50 hover:bg-muted/50">
              <span className="text-sm font-medium text-foreground">
                {fileName ?? t('upload.dropzone')}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{t('upload.fileFormats')}</span>
              <input
                type="file"
                accept={UPLOAD_FILE_ACCEPT}
                className="sr-only"
                onChange={onFileChange}
              />
            </label>
          </CardContent>
        </Card>

        {validation && !validation.valid && (
          <Card>
            <CardHeader>
              <CardTitle>{t('upload.errorsTitle')}</CardTitle>
              <CardDescription>{validation.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-auto rounded-md border border-red-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-red-50 text-red-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('upload.colRow')}</th>
                      <th className="px-3 py-2 font-medium">{t('upload.colColumn')}</th>
                      <th className="px-3 py-2 font-medium">{t('upload.colMessage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.errors.map((err, i) => (
                      <tr key={i} className="border-t border-red-50">
                        <td className="px-3 py-2 text-slate-600">{err.row ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{err.column ?? '—'}</td>
                        <td className="px-3 py-2">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {validation?.valid && previewRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('upload.previewTitle')}</CardTitle>
              <CardDescription>
                {t('upload.previewHint', {
                  shown: String(previewRows.length),
                  total: String(validation.rowCount),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      {previewKeys.map((key) => (
                        <th key={key} className="whitespace-nowrap px-3 py-2 font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {previewKeys.map((key) => (
                          <td key={key} className="whitespace-nowrap px-3 py-2 text-slate-600">
                            {String((row as Record<string, unknown>)[key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <Button type="button" disabled={importing} onClick={confirmImport}>
                  {importing ? t('upload.importing') : t('upload.confirmImport')}
                </Button>
                <Alert variant="success" className="flex-1 py-2">
                  {validation.summary}
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {importMessage && (
          <Alert variant={importMessage.toLowerCase().includes('imported') ? 'success' : 'error'}>
            {importMessage}
          </Alert>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.activeDataTitle')}</CardTitle>
          <CardDescription>
            {UPLOAD_TEMPLATES[viewType]?.label} — {t('upload.activeDataHint')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeData && activeData.rows.length > 0 ? (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('upload.activeDataRows', { count: String(activeData.rowCount) })}
              </p>
              <DataTable rows={activeData.rows} keys={activeKeys} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('upload.activeDataEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.latestTitle')}</CardTitle>
          <CardDescription>{t('upload.latestHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {latestByType.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('upload.historyEmpty')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {latestByType.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => showActiveView(batch.templateType as UploadTemplateType)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:border-primary/50 ${
                    viewMode === 'active' && viewType === batch.templateType
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {UPLOAD_TEMPLATES[batch.templateType as UploadTemplateType]?.label ??
                        batch.templateType}
                    </span>
                    <Badge variant="success">{t('upload.latestBadge')}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {batch.fileName} · {batch.rowCount ?? 0} {t('upload.rows')} ·{' '}
                    {new Date(batch.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.historyTitle')}</CardTitle>
          <CardDescription>{t('upload.historyHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('upload.historyEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {batches.map((batch) => (
                <li key={batch.id}>
                  <button
                    type="button"
                    onClick={() =>
                      loadBatchDetail(batch.id, batch.templateType as UploadTemplateType)
                    }
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:border-primary/50 ${
                      selectedBatchId === batch.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{batch.fileName}</span>
                      <div className="flex items-center gap-2">
                        {batch.hasSnapshot === false && (
                          <Badge variant="warning">{t('upload.noSnapshot')}</Badge>
                        )}
                        <StatusBadge status={batch.status} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {UPLOAD_TEMPLATES[batch.templateType as UploadTemplateType]?.label ??
                        batch.templateType}{' '}
                      · {batch.rowCount ?? 0} {t('upload.rows')} ·{' '}
                      {new Date(batch.createdAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {viewMode === 'snapshot' && (selectedBatchId || loadingDetail) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.snapshotTitle')}</CardTitle>
            <CardDescription>
              {batchDetail
                ? `${UPLOAD_TEMPLATES[batchDetail.templateType as UploadTemplateType]?.label ?? batchDetail.templateType} — ${batchDetail.fileName}`
                : t('upload.detailLoading')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDetail ? (
              <p className="text-sm text-muted-foreground">{t('upload.detailLoading')}</p>
            ) : batchDetail && !batchDetail.hasSnapshot ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t('upload.noSnapshotDetail')}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => showActiveView(batchDetail.templateType as UploadTemplateType)}
                >
                  {t('upload.viewActiveData')}
                </Button>
              </div>
            ) : batchDetail && snapshotRows.length > 0 ? (
              <DataTable rows={snapshotRows} keys={snapshotKeys} />
            ) : null}
            {batchDetail && (
              <Button
                type="button"
                variant="outline"
                onClick={() => showActiveView(batchDetail.templateType as UploadTemplateType)}
              >
                {t('upload.viewActiveData')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DataTable({ rows, keys }: { rows: Record<string, unknown>[]; keys: readonly string[] }) {
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-slate-700">
          <tr>
            {keys.map((key) => (
              <th key={key} className="whitespace-nowrap px-3 py-2 font-medium">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {keys.map((key) => (
                <td key={key} className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {String((row as Record<string, unknown>)[key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning';
  return <Badge variant={variant}>{status}</Badge>;
}
