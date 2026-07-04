'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, CircleCheck, TriangleAlert } from 'lucide-react';
import { useConfidenceReport } from '@/hooks/use-confidence-report';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConfidenceRating } from '@/lib/module-types';

const RATING_VARIANT: Record<ConfidenceRating, 'success' | 'warning' | 'error'> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

export function ForecastQualityCard() {
  const { data, isLoading } = useConfidenceReport();
  const { t } = useLanguage();
  const cl = (t.modules as Record<string, Record<string, unknown>>).confidenceLayer as Record<
    string,
    string
  >;
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">{cl.title}</CardTitle>
        <Badge variant={RATING_VARIANT[data.rating]}>
          {cl[`rating_${data.rating}`]} · {data.score}/100
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{data.recommendedNextAction}</p>

        <Button
          variant="ghost"
          className="flex items-center gap-1 px-2 py-1 text-xs"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? cl.hideDetails : cl.showDetails}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {expanded && (
          <div className="space-y-3">
            {data.strengths.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{cl.strengthsLabel}</p>
                {data.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cash-positive" />
                    {s}
                  </div>
                ))}
              </div>
            )}
            {data.weaknesses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{cl.weaknessesLabel}</p>
                {data.weaknesses.map((w, i) => (
                  <div key={i} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-medium text-foreground">{w.problem}</p>
                        <p className="text-xs text-muted-foreground">{w.businessImpact}</p>
                        <p className="text-xs text-primary">{w.fix}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Link href="/uploads">
                  <Button variant="outline" className="px-2 py-1 text-xs">
                    {cl.uploadDataCta}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
