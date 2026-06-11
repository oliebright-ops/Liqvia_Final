'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAiChat } from '@/hooks/use-ai-chat';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/treasury/page-header';
import { MarkdownReply } from './markdown-reply';

const QUICK_PROMPT_KEYS = [
  'runway',
  'expenses',
  'overdueAr',
  'suppliers',
  'cashPosition',
  'budget',
  'risks',
] as const;

export function AiCfoPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const ai = t.ai as Record<string, string>;
  const quick = t.aiQuick as Record<string, string>;
  const { messages, loading, error, send, clear } = useAiChat();

  useEffect(() => {
    clear();
  }, [user?.companyId, clear]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  async function submit(text?: string) {
    const value = text ?? input;
    if (!value.trim() || loading) return;
    setInput('');
    await send(value);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={ai.pageTitle ?? ai.title} subtitle={ai.pageSubtitle ?? ai.subtitle} />

      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPT_KEYS.map((key) => (
          <Button
            key={key}
            variant="outline"
            className="px-2 py-1 text-xs"
            disabled={loading}
            onClick={() => void submit(quick[key])}
          >
            {quick[key]}
          </Button>
        ))}
      </div>

      <Card className="flex min-h-[480px] flex-col">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle>{ai.title}</CardTitle>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={clear}>
                {ai.clearChat}
              </Button>
            )}
          </div>
          <CardDescription>{ai.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">{ai.emptyChat}</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm'
                    : 'max-w-[95%] rounded-lg border border-border bg-card px-3 py-2'
                }
              >
                {m.role === 'assistant' ? (
                  <MarkdownReply content={m.content} />
                ) : (
                  <p className="text-sm">{m.content}</p>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ai.placeholder}
              rows={2}
              className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <Button onClick={() => void submit()} disabled={loading || !input.trim()}>
              {loading ? ai.generating : ai.generate}
            </Button>
          </div>
          {error && <p className="text-xs text-cash-negative">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
