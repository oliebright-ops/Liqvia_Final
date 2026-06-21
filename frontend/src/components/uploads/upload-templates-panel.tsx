'use client';

import { useEffect, useId, useState } from 'react';
import { UPLOAD_LIBRARY_TEMPLATE_TYPES } from '@liqvia2/shared';
import { useTranslations } from '@/lib/i18n';
import {
  consumeUploadCenterWelcome,
  readUploadTemplatesPanelOpen,
  writeUploadTemplatesPanelOpen,
} from '@/lib/upload-templates-preference';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadTemplateLibrary } from '@/components/uploads/upload-template-library';

type UploadTemplatesPanelProps = {
  /** When true, panel starts expanded (e.g. right after registration). */
  forceInitialOpen?: boolean;
};

export function UploadTemplatesPanel({ forceInitialOpen }: UploadTemplatesPanelProps) {
  const t = useTranslations();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    if (initialized) return;
    const welcome = consumeUploadCenterWelcome();
    const saved = readUploadTemplatesPanelOpen();
    let shouldOpen = false;
    if (welcome || forceInitialOpen) {
      shouldOpen = true;
    } else if (saved !== null) {
      shouldOpen = saved;
    }
    setJustRegistered(welcome || Boolean(forceInitialOpen));
    setOpen(shouldOpen);
    setInitialized(true);
  }, [forceInitialOpen, initialized]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      writeUploadTemplatesPanelOpen(next);
      return next;
    });
  };

  const templateCount = UPLOAD_LIBRARY_TEMPLATE_TYPES.length;

  return (
    <Card
      className={`overflow-hidden border-2 transition-colors ${
        open
          ? 'border-primary/60 shadow-glow-primary'
          : 'border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-glow-primary'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-primary/5 sm:items-center"
      >
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary sm:mt-0"
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-primary">{t('upload.templatesSectionTitle')}</span>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {t('upload.templatesCount', { count: String(templateCount) })}
            </span>
            {justRegistered && open && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                {t('upload.templatesWelcomeBadge')}
              </span>
            )}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {open ? t('upload.templatesSectionHint') : t('upload.templatesCollapsedHint')}
          </span>
        </span>
        <span
          className={`mt-1 shrink-0 text-primary transition-transform sm:mt-0 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div id={panelId}>
          <CardHeader className="border-t border-primary/20 pb-2 pt-4">
            <CardTitle className="text-base">{t('upload.templatesExpandedTitle')}</CardTitle>
            <CardDescription>{t('upload.templatesSectionHint')}</CardDescription>
          </CardHeader>
          <CardContent className="pb-6 pt-0">
            <UploadTemplateLibrary />
          </CardContent>
        </div>
      )}
    </Card>
  );
}
