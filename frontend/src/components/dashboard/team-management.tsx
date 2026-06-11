'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CompanyUser } from '@/lib/auth-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TeamManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'member' | 'viewer' | 'admin'>('member');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await apiGet<CompanyUser[]>('/users');
    setUsers(list);
  }, []);

  useEffect(() => {
    load().catch(() => setUsers([]));
  }, [load]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost('/users', { name, email, password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('member');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>Company users and access roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{u.name}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 capitalize">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {isAdmin && (
          <form
            onSubmit={addUser}
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-sm font-semibold text-slate-900">Add user</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                type="password"
                placeholder="Temporary password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add user'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
