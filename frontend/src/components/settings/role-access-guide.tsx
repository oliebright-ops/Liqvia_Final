'use client';

import {
  ACCESS_GUIDE_ROLES,
  getRoleAccessLevels,
  ROLE_ACCESS_AREAS,
  type RoleAccessArea,
  type RoleAccessLevel,
  type UserRole,
} from '@liqvia2/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function levelBadgeVariant(level: RoleAccessLevel): 'success' | 'warning' | 'muted' | 'default' {
  if (level === 'full') return 'success';
  if (level === 'edit') return 'default';
  if (level === 'view') return 'warning';
  return 'muted';
}

function RoleAccessBadge({ level }: { level: RoleAccessLevel }) {
  const { t } = useLanguage();
  const access = (t.modules as Record<string, Record<string, string>>).settings.accessLevels;
  return (
    <Badge variant={levelBadgeVariant(level)} className="text-[10px] uppercase tracking-wide">
      {access[level]}
    </Badge>
  );
}

function RoleSummary({ role }: { role: UserRole }) {
  const { t } = useLanguage();
  const roles = (t.modules as Record<string, Record<string, Record<string, string>>>).settings.roles;
  return <p className="text-sm text-muted-foreground">{roles[role]?.summary}</p>;
}

export function YourAccessCard({ role }: { role: UserRole }) {
  const { t } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const roles = (t.modules as Record<string, Record<string, Record<string, string>>>).settings.roles;
  const areas = (t.modules as Record<string, Record<string, string>>).settings.accessAreas;
  const levels = getRoleAccessLevels(role);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{set.yourAccessTitle}</CardTitle>
        <CardDescription>
          {set.yourAccessSubtitle}{' '}
          <span className="font-medium capitalize text-foreground">{roles[role]?.label ?? role}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RoleSummary role={role} />
        <ul className="space-y-2">
          {ROLE_ACCESS_AREAS.map((area) => (
            <li
              key={area}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>{areas[area]}</span>
              <RoleAccessBadge level={levels[area]} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function RoleAccessMatrix() {
  const { t } = useLanguage();
  const set = (t.modules as Record<string, Record<string, string>>).settings;
  const roles = (t.modules as Record<string, Record<string, Record<string, string>>>).settings.roles;
  const areas = (t.modules as Record<string, Record<string, string>>).settings.accessAreas;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{set.accessMatrixTitle}</CardTitle>
        <CardDescription>{set.accessMatrixSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{set.colRole}</th>
              {ROLE_ACCESS_AREAS.map((area) => (
                <th key={area} className="px-3 py-2 font-medium">
                  {areas[area]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACCESS_GUIDE_ROLES.map((role) => {
              const levels = getRoleAccessLevels(role);
              return (
                <tr key={role} className="border-b border-border/60 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium capitalize">{roles[role]?.label ?? role}</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">{roles[role]?.summary}</p>
                  </td>
                  {ROLE_ACCESS_AREAS.map((area: RoleAccessArea) => (
                    <td key={area} className="px-3 py-3">
                      <RoleAccessBadge level={levels[area]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function RoleInviteHint({ role }: { role: UserRole }) {
  const { t } = useLanguage();
  const roles = (t.modules as Record<string, Record<string, Record<string, string>>>).settings.roles;
  const levels = getRoleAccessLevels(role);
  const areas = (t.modules as Record<string, Record<string, string>>).settings.accessAreas;
  const access = (t.modules as Record<string, Record<string, string>>).settings.accessLevels;

  const highlights = ROLE_ACCESS_AREAS.filter((area) => levels[area] !== 'none');

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
      <p className="font-medium capitalize">{roles[role]?.label ?? role}</p>
      <p className="mt-1 text-xs text-muted-foreground">{roles[role]?.summary}</p>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {highlights.map((area) => (
          <li key={area} className="flex items-center justify-between gap-2">
            <span>{areas[area]}</span>
            <span className={cn(levels[area] === 'full' && 'text-cash-positive')}>
              {access[levels[area]]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function roleLabel(role: string, t: ReturnType<typeof useLanguage>['t']): string {
  const roles = (t.modules as Record<string, Record<string, Record<string, string>>>).settings.roles;
  return roles[role as UserRole]?.label ?? role;
}
