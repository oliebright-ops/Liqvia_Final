'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiPost } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { useLanguage } from '@/lib/i18n';

type ForgotPasswordResponse = {
  message: string;
  devResetUrl?: string;
};

export default function ForgotPasswordPage() {
  const { t, format } = useLanguage();
  const auth = t.auth as Record<string, string>;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDevResetUrl(null);
    try {
      const res = await apiPost<ForgotPasswordResponse>('/auth/forgot-password', { email });
      setSubmitted(true);
      if (res.devResetUrl) {
        setDevResetUrl(res.devResetUrl);
      }
    } catch (err) {
      setError(formatApiError(format, err, auth.forgotPasswordFailed));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{auth.forgotPasswordTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{auth.forgotPasswordSent}</p>
                {devResetUrl && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <p className="font-medium text-amber-100">{auth.devResetLinkTitle}</p>
                    <p className="mt-1 text-xs text-amber-200/80">{auth.devResetLinkHint}</p>
                    <a
                      href={devResetUrl}
                      className="mt-2 block break-all text-amber-300 underline hover:text-amber-200"
                    >
                      {devResetUrl}
                    </a>
                  </div>
                )}
                <Link
                  href="/login"
                  className="block text-center text-sm font-medium text-primary hover:underline"
                >
                  {auth.backToSignIn}
                </Link>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">{auth.forgotPasswordHint}</p>
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
                  {error && <p className="text-sm text-cash-negative">{error}</p>}
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? auth.sendingResetLink : auth.sendResetLink}
                  </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    {auth.backToSignIn}
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
