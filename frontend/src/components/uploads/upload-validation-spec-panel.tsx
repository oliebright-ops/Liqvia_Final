'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n';

const RULES = [
  'duplicates',
  'amounts',
  'dates',
  'currency',
  'periodWindow',
  'supplierPriority',
] as const;

export function UploadValidationSpecPanel() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t('upload.validationSpec.title')}</CardTitle>
            <CardDescription>{t('upload.validationSpec.subtitle')}</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-expanded={open}
          >
            {open ? t('forecast.assumptionsPanel.collapse') : t('forecast.assumptionsPanel.expand')}
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 border-t border-border pt-4">
          <ul className="space-y-3">
            {RULES.map((rule) => (
              <li key={rule} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">
                  {t(`upload.validationSpec.rules.${rule}.title`)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`upload.validationSpec.rules.${rule}.body`)}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t('upload.validationSpec.footer')}</p>
        </CardContent>
      )}
    </Card>
  );
}
