'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, FlaskConical, Plus } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CompanyLink, OnboardingContext } from '@/lib/auth-types';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function CompanySwitcher({
  compact = false,
  tone = 'default',
}: {
  compact?: boolean;
  tone?: 'default' | 'dark';
}) {
  const { user, selectCompany } = useAuth();
  const { t } = useLanguage();
  const cs = t.companySwitcher as Record<string, string>;
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<CompanyLink[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    try {
      const ctx = await apiGet<OnboardingContext>('/onboarding/context');
      setLinks(ctx.companyLinks);
      setError(null);
    } catch (e) {
      setLinks([]);
      setError(e instanceof Error ? e.message : 'Failed to load entities');
    }
  }, []);

  useEffect(() => {
    if (user) loadLinks();
  }, [user?.id, user?.companyId, loadLinks]);

  if (!user) return null;

  const label = user.isDemoMode ? cs.demoLabel : (user.companyName ?? cs.selectCompany);
  const dark = tone === 'dark';

  async function onSelect(companyId: string) {
    if (companyId === user?.companyId && !user?.isDemoMode) {
      setOpen(false);
      return;
    }
    setSwitching(companyId);
    setError(null);
    try {
      await selectCompany(companyId);
      await loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch entity');
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border text-left transition-colors',
          compact ? 'min-w-[180px] px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm',
          dark
            ? 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'
            : 'border-border bg-muted/40 hover:bg-muted',
        )}
      >
        {user.isDemoMode ? (
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-400" />
        ) : (
          <Building2 className={cn('h-4 w-4 shrink-0', dark ? 'text-blue-400' : 'text-primary')} />
        )}
        <span className={cn('min-w-0 flex-1 truncate font-medium', dark && 'text-white')}>
          {label}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            dark ? 'text-slate-400' : 'text-muted-foreground',
            open && 'rotate-180',
          )}
        />
      </button>

      {error && (
        <p className={cn('mt-1 text-xs', dark ? 'text-red-400' : 'text-cash-negative')}>{error}</p>
      )}

      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 rounded-lg border py-1 shadow-lg',
            compact ? 'right-0 min-w-[220px]' : 'left-0 right-0',
            dark ? 'border-slate-700 bg-slate-900' : 'border-border bg-card',
          )}
        >
          {links.length === 0 ? (
            <p
              className={cn('px-3 py-2 text-xs', dark ? 'text-slate-400' : 'text-muted-foreground')}
            >
              {cs.noLinks}
            </p>
          ) : (
            links.map((link) => (
              <button
                key={link.companyId}
                type="button"
                disabled={Boolean(switching)}
                onClick={() => void onSelect(link.companyId)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted',
                  link.companyId === user.companyId && !user.isDemoMode && 'bg-muted/60',
                  dark && 'text-slate-100 hover:bg-slate-800',
                  dark && link.companyId === user.companyId && !user.isDemoMode && 'bg-slate-800',
                )}
              >
                <span className="truncate font-medium">{link.companyName}</span>
                <span className={cn('ml-2', dark ? 'text-slate-400' : 'text-muted-foreground')}>
                  {switching === link.companyId ? '…' : link.role}
                </span>
              </button>
            ))
          )}
          <div className={cn('border-t px-2 py-1', dark ? 'border-slate-700' : 'border-border')}>
            <Link
              href="/settings?tab=entities"
              onClick={() => setOpen(false)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-medium hover:bg-muted',
                dark ? 'text-blue-400 hover:bg-slate-800' : 'text-primary',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {cs.addEntity}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
