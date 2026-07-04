'use client';

import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import { Sidebar } from './sidebar';
import { CompanySwitcher } from './company-switcher';
import { LanguageSwitcher } from './language-switcher';
import { NotificationsBell } from './notifications-bell';
import { DemoBanner } from '@/components/onboarding/demo-banner';

export function TreasuryLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const layout = t.layout as Record<string, string>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <div />
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <NotificationsBell />
            <CompanySwitcher compact />
            <LanguageSwitcher compact />
            {user && <span className="hidden text-foreground sm:inline">{user.name}</span>}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted hover:text-foreground"
            >
              {layout.signOut}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <DemoBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
