'use client';

import { Card, CardContent } from '@/components/ui/card';

export function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className={i === 0 ? 'border-primary/20' : undefined}>
            <CardContent className="p-4">
              <div className="h-2.5 w-24 rounded bg-muted" />
              <div className="mt-3 h-7 w-28 rounded bg-muted" />
              <div className="mt-2 h-3 w-32 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="h-[320px] p-4" />
        </Card>
        <Card>
          <CardContent className="h-[320px] p-4" />
        </Card>
      </div>
    </div>
  );
}
