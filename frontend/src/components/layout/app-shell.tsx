'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

interface AppShellProps {
  children: React.ReactNode;
  /** Overrides the default header entirely (used by the marketing landing page). */
  header?: React.ReactNode;
  /** Overrides the default `<main>` container className. */
  mainClassName?: string;
}

/** Lightweight header for public/auth pages (treasury app uses TreasuryLayout). */
export function AppShell({ children, header, mainClassName }: AppShellProps) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const auth = t.auth as Record<string, string>;
  const nav = t.nav as Record<string, string>;
  const layout = t.layout as Record<string, string>;

  return (
    <div className="min-h-screen bg-background">
      {header ?? (
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold text-foreground">
              {(t.app as Record<string, string>).title}
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              {user ? (
                <>
                  <Link href="/dashboard" className="hover:text-foreground">
                    {nav.dashboard}
                  </Link>
                  <span>{user.name}</span>
                  <button type="button" onClick={logout} className="hover:text-foreground">
                    {layout.signOut}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-foreground">
                    {auth.signIn}
                  </Link>
                  <Link href="/register" className="hover:text-foreground">
                    {auth.register}
                  </Link>
                </>
              )}
              <LanguageSwitcher compact />
            </nav>
          </div>
        </header>
      )}
      <main className={cn('mx-auto max-w-6xl px-6 py-8', mainClassName)}>{children}</main>
    </div>
  );
}
