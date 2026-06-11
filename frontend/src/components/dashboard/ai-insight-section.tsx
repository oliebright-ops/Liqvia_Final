'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { AiInsightResponse } from '@/lib/dashboard-types';
import { NestedTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AiInsightSection({
  companyId,
  t,
}: {
  companyId: string;
  t: NestedTranslations;
}) {
  const ai = t.ai as Record<string, string>;
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AiInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<AiInsightResponse>('/ai/insight', {
        companyId,
        question: question.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : ai.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2">
        <Link href="/ai-cfo" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <CardTitle className="hover:text-primary">{ai.title}</CardTitle>
        </Link>
        <CardDescription>{ai.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-4 p-4 pt-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={ai.placeholder}
          rows={2}
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button onClick={() => void generate()} disabled={loading} className="shadow-glow-primary">
          {loading ? ai.generating : ai.generate}
        </Button>

        {error && <p className="text-xs text-cash-negative">{error}</p>}

        {result && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">{result.insight}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {result.source === 'openai'
                ? t.format('ai.sourceOpenai', { model: result.model })
                : ai.sourceRule}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
