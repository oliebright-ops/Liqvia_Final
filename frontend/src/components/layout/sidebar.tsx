'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileUp,
  GitBranch,
  LayoutDashboard,
  Receipt,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { canAccessRoute } from '@liqvia2/shared';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CompanySwitcher } from './company-switcher';
import { LanguageSwitcher } from './language-switcher';

const NAV = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/bank-accounts', labelKey: 'bankAccounts', icon: Wallet },
  { href: '/forecast', labelKey: 'forecast', icon: TrendingUp },
  { href: '/budget', labelKey: 'budget', icon: BarChart3 },
  { href: '/ledger', labelKey: 'ledger', icon: Receipt },
  { href: '/scenarios', labelKey: 'scenarios', icon: GitBranch },
  { href: '/ai-cfo', labelKey: 'aiCfo', icon: Sparkles },
  { href: '/uploads', labelKey: 'uploads', icon: FileUp },
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLanguage();
  const nav = t.nav as Record<string, string>;
  const app = t.app as Record<string, string>;
  const layout = t.layout as Record<string, string>;
  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = useMemo(() => {
    if (!user?.role || user.isDemoMode) return NAV;
    return NAV.filter((item) => canAccessRoute(user.role, item.href));
  }, [user?.role, user?.isDemoMode]);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('border-b border-border p-4', collapsed && 'px-2')}>
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-glow-primary">
            L
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{app.title}</p>
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {app.tagline}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mt-4">
            <CompanySwitcher />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {visibleNav.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const label = nav[labelKey];
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary shadow-glow-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t border-border p-3', collapsed && 'px-2')}>
        {!collapsed && <LanguageSwitcher />}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'mt-2 flex w-full items-center justify-center rounded-lg border border-border py-2 text-muted-foreground hover:bg-muted hover:text-foreground',
            !collapsed && 'gap-2',
          )}
          aria-label={collapsed ? layout.expandSidebar : layout.collapseSidebar}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">{nav.collapse}</span>}
        </button>
      </div>
    </aside>
  );
}
