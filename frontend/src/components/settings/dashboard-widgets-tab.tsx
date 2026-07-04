'use client';

import { DASHBOARD_WIDGET_KEYS, DashboardWidgetKey } from '@liqvia2/shared';
import { useDashboardWidgetPrefs } from '@/hooks/use-dashboard-widget-prefs';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardWidgetsTab() {
  const { prefs, updatePrefs, isSaving } = useDashboardWidgetPrefs();
  const { t } = useLanguage();
  const dw = (t.modules as Record<string, Record<string, unknown>>).dashboardWidgets as Record<
    string,
    string
  >;

  function toggle(key: DashboardWidgetKey) {
    updatePrefs({ ...prefs, [key]: !prefs[key] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dw.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{dw.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {DASHBOARD_WIDGET_KEYS.map((key) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span className="text-sm text-foreground">{dw[`widget_${key}`] ?? key}</span>
            <input
              type="checkbox"
              checked={prefs[key]}
              disabled={isSaving}
              onChange={() => toggle(key)}
              className="h-4 w-4 rounded border-border"
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
