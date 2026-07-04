/** Canonical set of independently-togglable dashboard widgets — "let them pick what
 * they want on their dashboard" per partner-interview feedback. Widgets keep their
 * existing fixed layout position; this controls visibility only, not reordering. */
export const DASHBOARD_WIDGET_KEYS = [
  'businessPulse',
  'kpiGrid',
  'dataQuality',
  'forecastQuality',
  'whyChanged',
  'forecast',
  'alerts',
  'recentTransactions',
  'aiInsight',
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

export type DashboardWidgetPrefs = Record<DashboardWidgetKey, boolean>;

export const DEFAULT_DASHBOARD_WIDGET_PREFS: DashboardWidgetPrefs = DASHBOARD_WIDGET_KEYS.reduce(
  (acc, key) => ({ ...acc, [key]: true }),
  {} as DashboardWidgetPrefs,
);

/** Merges stored prefs over the defaults so a newly-added widget key defaults to
 * visible for users who saved preferences before it existed. */
export function normalizeDashboardWidgetPrefs(raw: unknown): DashboardWidgetPrefs {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return DASHBOARD_WIDGET_KEYS.reduce((acc, key) => {
    acc[key] = typeof stored[key] === 'boolean' ? (stored[key] as boolean) : true;
    return acc;
  }, {} as DashboardWidgetPrefs);
}
