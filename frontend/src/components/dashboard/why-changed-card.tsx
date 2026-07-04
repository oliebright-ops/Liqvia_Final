'use client';

import { HelpCircle } from 'lucide-react';
import { useWhyChanged } from '@/hooks/use-why-changed';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { MarkdownReply } from '@/components/ai-cfo/markdown-reply';

export function WhyChangedCard() {
  const { data, isLoading, triggered, trigger } = useWhyChanged();
  const { t } = useLanguage();
  const wc = (t.modules as Record<string, Record<string, unknown>>).whyChanged as Record<
    string,
    string
  >;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      {!triggered && (
        <Button variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 text-xs" onClick={trigger}>
          <HelpCircle className="h-3.5 w-3.5" />
          {wc.trigger}
        </Button>
      )}

      {triggered && isLoading && <p className="text-xs text-muted-foreground">{wc.loading}</p>}

      {triggered && !isLoading && data && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{wc.title}</p>
          <MarkdownReply content={data.text} />
        </div>
      )}
    </div>
  );
}
