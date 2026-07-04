'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  DashboardWidgetPrefs,
  DEFAULT_DASHBOARD_WIDGET_PREFS,
} from '@liqvia2/shared';
import { apiGet, apiPatch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const dashboardWidgetPrefsKey = (userId: string | null) => ['dashboard-widget-prefs', userId] as const;

export function useDashboardWidgetPrefs() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardWidgetPrefsKey(userId),
    queryFn: () => apiGet<DashboardWidgetPrefs>('/settings/dashboard-widgets'),
    enabled: !!userId,
  });

  const update = useMutation({
    mutationFn: (prefs: DashboardWidgetPrefs) =>
      apiPatch<DashboardWidgetPrefs>('/settings/dashboard-widgets', prefs),
    onSuccess: (prefs) => {
      queryClient.setQueryData(dashboardWidgetPrefsKey(userId), prefs);
    },
  });

  return {
    prefs: query.data ?? DEFAULT_DASHBOARD_WIDGET_PREFS,
    isLoading: query.isLoading,
    updatePrefs: update.mutate,
    isSaving: update.isPending,
  };
}
