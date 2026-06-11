'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const auth = t.auth as Record<string, string>;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({ name, email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : auth.registerFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{auth.createYourAccount}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-muted-foreground">{auth.yourName}</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-muted-foreground">{auth.workEmail}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-muted-foreground">{auth.password}</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
              {error && <p className="text-sm text-cash-negative">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? auth.creatingAccount : auth.createAccount}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {auth.hasAccount}{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {auth.signIn}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
