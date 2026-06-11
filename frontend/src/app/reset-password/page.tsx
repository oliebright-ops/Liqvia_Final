'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiPost } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { useLanguage } from '@/lib/i18n';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { t, format } = useLanguage();
  const auth = t.auth as Record<string, string>;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(auth.passwordMismatch);
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(formatApiError(format, err, auth.resetPasswordFailed));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-cash-negative">{auth.resetLinkInvalid}</p>
        <Link
          href="/forgot-password"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          {auth.requestNewResetLink}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{auth.resetPasswordSuccess}</p>
        <Link
          href="/login"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          {auth.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-muted-foreground">{auth.newPassword}</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-muted-foreground">{auth.confirmPassword}</span>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-cash-negative">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? auth.updatingPassword : auth.updatePassword}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const auth = t.auth as Record<string, string>;

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{auth.resetPasswordTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={<p className="text-sm text-muted-foreground">{t.common.loading}</p>}
            >
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
