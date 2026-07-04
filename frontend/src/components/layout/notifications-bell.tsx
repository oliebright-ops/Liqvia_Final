'use client';

import { useState } from 'react';
import { Bell, Lock } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useLanguage } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SEVERITY_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  info: 'success',
  warning: 'warning',
  critical: 'error',
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data, markRead } = useNotifications();
  const { t } = useLanguage();
  const nt = (t.modules as Record<string, Record<string, unknown>>).notifications as Record<
    string,
    string
  >;

  const unreadCount =
    data && !data.locked ? data.notifications.filter((n) => !n.read).length : (data?.unreadCount ?? 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={nt.title}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cash-negative px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-2 text-sm font-semibold text-foreground">
            {nt.title}
          </div>

          {!data && <div className="px-4 py-6 text-center text-xs text-muted-foreground">{nt.loading}</div>}

          {data?.locked && (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{data.message}</p>
              <Badge variant="muted">{nt.upgradeCta}</Badge>
            </div>
          )}

          {data && !data.locked && data.notifications.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">{nt.empty}</div>
          )}

          {data && !data.locked && data.notifications.length > 0 && (
            <ul className="max-h-96 overflow-y-auto">
              {data.notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex flex-col gap-1 border-b border-border/60 px-4 py-3 last:border-b-0',
                    !n.read && 'bg-muted/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{n.title}</p>
                    <Badge variant={SEVERITY_VARIANT[n.severity] ?? 'muted'}>{n.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  {!n.read && (
                    <button
                      type="button"
                      className="self-start text-[11px] font-medium text-primary hover:underline"
                      onClick={() => markRead(n.id)}
                    >
                      {nt.markRead}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
