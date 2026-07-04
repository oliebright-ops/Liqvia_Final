'use client';

import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { notificationsKey } from '@/lib/query-client';
import type { NotificationsResponse } from '@/lib/module-types';

export function useNotifications() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notificationsKey(companyId),
    queryFn: () => apiGet<NotificationsResponse>('/notifications'),
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiPost(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey(companyId) });
    },
  });

  return { ...query, markRead: markRead.mutate };
}
