'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatApiError } from '@/lib/api-errors';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';

export default function LoginPage() {
  const { login, exploreDemo } = useAuth();
  const { t, format } = useLanguage();
  const auth = t.auth as Record<string, string>;
  const landing = (t.home as Record<string, Record<string, string>>).landing;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(formatApiError(format, err, auth.loginFailed));
    } finally {
      setSubmitting(false);
    }
  }

  async function onExploreDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      await exploreDemo();
    } catch (err) {
      setError(formatApiError(format, err, landing.demoError));
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{auth.signIn}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-muted-foreground">{auth.email}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground">{auth.password}</span>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {auth.forgotPassword}
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
              {error && <p className="text-sm text-cash-negative">{error}</p>}
              <Button type="submit" disabled={submitting || demoLoading} className="w-full">
                {submitting ? auth.signingIn : auth.signIn}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">{auth.orDivider}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void onExploreDemo()}
              disabled={demoLoading || submitting}
              className="flex w-full items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left transition-colors hover:border-amber-500/60 hover:bg-amber-500/15 disabled:opacity-50"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-lg"
                aria-hidden
              >
                🧪
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-amber-100">
                  {landing.demoTitle}
                </span>
                <span className="block text-xs text-amber-200/70">{landing.demoHint}</span>
              </span>
              <span className="shrink-0 text-amber-400">{demoLoading ? '…' : '›'}</span>
            </button>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {auth.noAccount}{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                {auth.createAccount}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
