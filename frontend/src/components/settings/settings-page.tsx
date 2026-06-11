'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CURRENCIES } from '@liqvia2/shared';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { notifyWorkspaceRefresh } from '@/lib/workspace-refresh';
import { useAuth } from '@/lib/auth-context';
import { AuthResponse, CompanyLink, OnboardingContext } from '@/lib/auth-types';
import { useLanguage } from '@/lib/i18n';
import {
  ChartOfAccountView,
  CompanySettings,
  TeamMemberView,
} from '@/lib/module-types';
import {
  coaFormSchema,
  companyFormSchema,
  entityFormSchema,
  inviteFormSchema,
  profileFormSchema,
  CoaFormValues,
  CompanyFormValues,
  EntityFormValues,
  InviteFormValues,
  ProfileFormValues,
} from '@/lib/validation/settings-schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FinancialTable } from '@/components/ui/financial-table';
import { PageHeader } from '@/components/treasury/page-header';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'entities' | 'company' | 'team' | 'coa';

export function SettingsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const mod = t.modules as Record<string, Record<string, string>>;
  const set = mod.settings;
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'profile';
  const [tab, setTab] = useState<Tab>(
    ['profile', 'entities', 'company', 'team', 'coa'].includes(initialTab) ? initialTab : 'profile',
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: set.tabProfile },
    { id: 'entities', label: set.tabEntities },
    { id: 'company', label: set.tabCompany },
    { id: 'team', label: set.tabTeam },
    { id: 'coa', label: set.tabCoa },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={set.title} subtitle={set.subtitle} />
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === item.id
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'entities' && <EntitiesTab />}
      {tab === 'company' && <CompanyTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'coa' && <CoaTab />}
    </div>
  );
}

function fieldClass() {
  return 'w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
}

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const [saved, setSaved] = useState(false);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  useEffect(() => {
    if (user?.name) form.reset({ name: user.name });
  }, [user?.name, form]);

  async function onSubmit(values: ProfileFormValues) {
    await apiPatch('/settings/profile', values);
    await refreshUser();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{set.tabProfile}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">{set.fieldName}</label>
            <input {...form.register('name')} className={fieldClass()} />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-cash-negative">{form.formState.errors.name.message}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {set.save}
          </Button>
          {saved && <span className="ml-2 text-xs text-cash-positive">{set.saved}</span>}
        </form>
      </CardContent>
    </Card>
  );
}

function roleBadgeVariant(role: string): 'success' | 'warning' | 'muted' | 'default' {
  if (role === 'owner' || role === 'admin') return 'success';
  if (role === 'viewer') return 'warning';
  return 'default';
}

function EntitiesTab() {
  const { user, selectCompany, applyAuthResponse, refreshUser } = useAuth();
  const router = useRouter();
  const { t, format } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const [links, setLinks] = useState<CompanyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const form = useForm<EntityFormValues>({
    resolver: zodResolver(entityFormSchema),
    defaultValues: {
      name: '',
      industry: '',
      currency: 'GBP',
      locale: 'en',
      fiscalYearStart: 1,
      forecastHorizonWeeks: 13,
      openingCashBalance: 0,
      switchToNew: true,
    },
  });

  const loadLinks = useCallback(async () => {
    const ctx = await apiGet<OnboardingContext>('/onboarding/context');
    setLinks(ctx.companyLinks);
    await refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    loadLinks().finally(() => setLoading(false));
  }, [loadLinks]);

  async function onSwitch(companyId: string) {
    if (companyId === user?.companyId) return;
    setSwitching(companyId);
    try {
      await selectCompany(companyId);
    } finally {
      setSwitching(null);
    }
  }

  async function onSubmit(values: EntityFormValues) {
    const res = await apiPost<AuthResponse>('/onboarding/add-entity', {
      ...values,
      industry: values.industry || undefined,
    });
    await applyAuthResponse(res);
    await loadLinks();
    notifyWorkspaceRefresh();
    setCreated(true);
    form.reset({
      name: '',
      industry: '',
      currency: values.currency,
      locale: values.locale,
      fiscalYearStart: values.fiscalYearStart,
      forecastHorizonWeeks: values.forecastHorizonWeeks,
      openingCashBalance: 0,
      switchToNew: true,
    });
    if (values.switchToNew) {
      router.push('/dashboard');
    }
    setTimeout(() => setCreated(false), 2500);
  }

  if (loading) return <p className="text-sm text-muted-foreground">{format('dashboard.loading')}</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{set.entitiesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{set.entitiesPermissionHint}</p>
          {links.length === 0 ? (
            <EmptyState title={set.entitiesEmpty} description={set.entitiesEmptyHint} />
          ) : (
            links.map((link) => (
              <div
                key={link.companyId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{link.companyName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={roleBadgeVariant(link.role)}>{link.role}</Badge>
                    {link.role === 'viewer' && (
                      <span className="text-xs text-muted-foreground">{set.entitiesViewerHint}</span>
                    )}
                  </div>
                </div>
                {link.companyId === user?.companyId ? (
                  <Badge variant="success">{set.entitiesActive}</Badge>
                ) : (
                  <Button
                    variant="outline"
                    className="px-2 py-1 text-xs"
                    disabled={Boolean(switching)}
                    onClick={() => void onSwitch(link.companyId)}
                  >
                    {switching === link.companyId ? '…' : set.entitiesSwitch}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{set.entitiesAddTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">{set.field_name}</label>
              <input {...form.register('name')} className={fieldClass()} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{set.field_industry}</label>
              <input {...form.register('industry')} className={fieldClass()} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{set.field_currency}</label>
              <select {...form.register('currency')} className={fieldClass()}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{set.field_fiscalYearStart}</label>
              <input type="number" {...form.register('fiscalYearStart')} className={fieldClass()} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{set.field_forecastHorizon}</label>
              <input type="number" {...form.register('forecastHorizonWeeks')} className={fieldClass()} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">{set.entitiesOpeningCash}</label>
              <input type="number" {...form.register('openingCashBalance')} className={fieldClass()} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" {...form.register('switchToNew')} className="rounded border-border" />
              {set.entitiesSwitchAfterCreate}
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {set.entitiesAdd}
              </Button>
              {created && <span className="ml-2 text-xs text-cash-positive">{set.entitiesCreated}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyTab() {
  const { isAdmin } = useAuth();
  const { t, format } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const [loading, setLoading] = useState(true);
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
  });

  useEffect(() => {
    apiGet<CompanySettings>('/settings/company')
      .then((c) =>
        form.reset({
          name: c.name,
          industry: c.industry ?? '',
          currency: c.currency,
          locale: c.locale,
          fiscalYearStart: c.fiscalYearStart,
          forecastHorizonWeeks: c.forecastHorizonWeeks,
          forecastLookbackWeeks: c.forecastLookbackWeeks ?? 4,
          reportingPeriod: c.reportingPeriod ?? '',
          periodGranularity: c.periodGranularity ?? 'monthly',
        }),
      )
      .finally(() => setLoading(false));
  }, [form]);

  async function onSubmit(values: CompanyFormValues) {
    await apiPatch('/settings/company', {
      ...values,
      industry: values.industry || null,
      reportingPeriod: values.reportingPeriod?.trim() || null,
    });
    notifyWorkspaceRefresh();
  }

  if (loading) return <p className="text-sm text-muted-foreground">{format('dashboard.loading')}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{set.tabCompany}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">{set.field_name}</label>
            <input {...form.register('name')} className={fieldClass()} disabled={!isAdmin} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_industry}</label>
            <input {...form.register('industry')} className={fieldClass()} disabled={!isAdmin} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_currency}</label>
            <select {...form.register('currency')} className={fieldClass()} disabled={!isAdmin}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_locale}</label>
            <input {...form.register('locale')} className={fieldClass()} disabled={!isAdmin} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_fiscalYearStart}</label>
            <input type="number" {...form.register('fiscalYearStart')} className={fieldClass()} disabled={!isAdmin} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_forecastHorizon}</label>
            <input type="number" {...form.register('forecastHorizonWeeks')} className={fieldClass()} disabled={!isAdmin} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_forecastLookback}</label>
            <input type="number" {...form.register('forecastLookbackWeeks')} className={fieldClass()} disabled={!isAdmin} />
            <p className="mt-1 text-xs text-muted-foreground">{set.field_forecastLookbackHint}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_periodGranularity}</label>
            <select {...form.register('periodGranularity')} className={fieldClass()} disabled={!isAdmin}>
              <option value="monthly">{set.periodMonthly}</option>
              <option value="weekly">{set.periodWeekly}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{set.field_reportingPeriod}</label>
            <input
              {...form.register('reportingPeriod')}
              placeholder={form.watch('periodGranularity') === 'weekly' ? '2026-W04' : '2026-01'}
              className={fieldClass()}
              disabled={!isAdmin}
            />
            <p className="mt-1 text-xs text-muted-foreground">{set.field_reportingPeriodHint}</p>
          </div>
          {isAdmin && (
            <div className="sm:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {set.save}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

const TEAM_ROLES = ['admin', 'member', 'viewer'] as const;

function TeamTab() {
  const { isAdmin, refreshUser } = useAuth();
  const { t } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const [members, setMembers] = useState<TeamMemberView[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { role: 'member' },
  });

  const load = useCallback(() => {
    apiGet<TeamMemberView[]>('/settings/team').then(setMembers).catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onInvite(values: InviteFormValues) {
    await apiPost('/settings/team/invite', values);
    form.reset({ name: '', email: '', password: '', role: 'member' });
    load();
  }

  async function remove(linkId: string) {
    await apiDelete(`/settings/team/${linkId}`);
    load();
  }

  async function updateRole(linkId: string, role: string) {
    setSavingRole(linkId);
    try {
      await apiPatch(`/settings/team/${linkId}/role`, { role });
      await load();
      await refreshUser();
    } finally {
      setSavingRole(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{set.tabTeam}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialTable
            rows={members}
            rowKey={(m) => m.id}
            columns={[
              { key: 'name', header: set.colName, render: (m) => m.name },
              { key: 'email', header: set.colEmail, muted: true, render: (m) => m.email },
              {
                key: 'role',
                header: set.colRole,
                render: (m) =>
                  isAdmin && m.role !== 'owner' ? (
                    <select
                      value={m.role}
                      disabled={savingRole === m.id}
                      className={fieldClass()}
                      onChange={(e) => void updateRole(m.id, e.target.value)}
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    m.role
                  ),
              },
              {
                key: 'status',
                header: set.colStatus,
                render: (m) => (
                  <Badge variant={m.status === 'active' ? 'cash-positive' : 'warning'}>
                    {m.status === 'active' ? set.statusActive : set.statusPending}
                  </Badge>
                ),
              },
              ...(isAdmin
                ? [
                    {
                      key: 'actions',
                      header: '',
                      render: (m: TeamMemberView) => (
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs text-cash-negative"
                          onClick={() => void remove(m.id)}
                        >
                          {set.remove}
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </CardContent>
      </Card>
      {isAdmin && (
        <p className="text-xs text-muted-foreground">{set.teamRoleHint}</p>
      )}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{set.inviteUser}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onInvite)} className="grid gap-3 sm:grid-cols-2">
              <input {...form.register('name')} placeholder={set.fieldName} className={fieldClass()} />
              <input {...form.register('email')} placeholder="Email" className={fieldClass()} />
              <input {...form.register('password')} type="password" placeholder={set.fieldPassword} className={fieldClass()} />
              <select {...form.register('role')} className={fieldClass()}>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {set.inviteUser}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CoaTab() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const [accounts, setAccounts] = useState<ChartOfAccountView[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ChartOfAccountView | null>(null);
  const form = useForm<CoaFormValues>({ resolver: zodResolver(coaFormSchema) });

  const load = useCallback(() => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    apiGet<ChartOfAccountView[]>(`/settings/chart-of-accounts${qs}`)
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values: CoaFormValues) {
    if (editing) {
      await apiPatch(`/settings/chart-of-accounts/${editing.id}`, values);
    } else {
      await apiPost('/settings/chart-of-accounts', values);
    }
    form.reset();
    setEditing(null);
    load();
  }

  async function archive(id: string) {
    await apiDelete(`/settings/chart-of-accounts/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={set.searchCoa}
        className={fieldClass() + ' max-w-sm'}
      />
      {accounts.length === 0 ? (
        <EmptyState title={set.coaEmpty} description={set.coaEmptyHint} />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <FinancialTable
              rows={accounts}
              rowKey={(a) => a.id}
              columns={[
                { key: 'code', header: set.colCode, mono: true, render: (a) => a.code },
                { key: 'name', header: set.colAccountName, render: (a) => a.name },
                { key: 'type', header: set.colType, muted: true, render: (a) => a.accountType },
                {
                  key: 'status',
                  header: set.colStatus,
                  render: () => <Badge variant="cash-positive">{set.statusActive}</Badge>,
                },
                ...(isAdmin
                  ? [
                      {
                        key: 'edit',
                        header: '',
                        render: (a: ChartOfAccountView) => (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              onClick={() => {
                                setEditing(a);
                                form.reset({
                                  code: a.code,
                                  name: a.name,
                                  accountType: a.accountType as CoaFormValues['accountType'],
                                });
                              }}
                            >
                              {set.edit}
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs text-cash-negative"
                              onClick={() => void archive(a.id)}
                            >
                              {set.archive}
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </CardContent>
        </Card>
      )}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? set.editAccount : set.createAccount}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-3">
              <input {...form.register('code')} placeholder={set.colCode} className={fieldClass()} />
              <input {...form.register('name')} placeholder={set.colAccountName} className={fieldClass()} />
              <select {...form.register('accountType')} className={fieldClass()}>
                {['asset', 'liability', 'equity', 'revenue', 'expense'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <Button type="submit">{editing ? set.save : set.createAccount}</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
