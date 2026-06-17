export type UserRole = 'owner' | 'admin' | 'member' | 'viewer' | 'uploader';

export type AppPermission =
  | 'treasury:read'
  | 'scenarios:read'
  | 'scenarios:write'
  | 'ai:use'
  | 'uploads:read'
  | 'uploads:write'
  | 'settings:profile'
  | 'settings:admin'
  | 'users:manage';

export type RoleAccessArea = 'treasury' | 'uploads' | 'scenarios' | 'ai' | 'administration';

export type RoleAccessLevel = 'none' | 'view' | 'edit' | 'full';

const ALL_PERMISSIONS: AppPermission[] = [
  'treasury:read',
  'scenarios:read',
  'scenarios:write',
  'ai:use',
  'uploads:read',
  'uploads:write',
  'settings:profile',
  'settings:admin',
  'users:manage',
];

/** Permission sets per role — owner/admin: everything; member: operate treasury + upload; viewer: read-only; uploader: upload center only. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly AppPermission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  member: [
    'treasury:read',
    'scenarios:read',
    'scenarios:write',
    'ai:use',
    'uploads:read',
    'uploads:write',
    'settings:profile',
  ],
  viewer: ['treasury:read', 'scenarios:read', 'ai:use', 'uploads:read', 'settings:profile'],
  uploader: ['uploads:read', 'uploads:write'],
};

export const USER_ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer', 'uploader'];

export const ASSIGNABLE_TEAM_ROLES: UserRole[] = ['admin', 'member', 'viewer', 'uploader'];

export const ROLE_ACCESS_AREAS: RoleAccessArea[] = [
  'treasury',
  'uploads',
  'scenarios',
  'ai',
  'administration',
];

export function hasPermission(role: UserRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: readonly AppPermission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasFullAccess(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function getDefaultAppPath(role: UserRole): string {
  if (role === 'uploader') return '/uploads';
  return '/dashboard';
}

export const ROUTE_PERMISSIONS: Record<string, AppPermission> = {
  '/dashboard': 'treasury:read',
  '/bank-accounts': 'treasury:read',
  '/forecast': 'treasury:read',
  '/budget': 'treasury:read',
  '/ledger': 'treasury:read',
  '/scenarios': 'scenarios:read',
  '/ai-cfo': 'ai:use',
  '/uploads': 'uploads:read',
  '/settings': 'settings:profile',
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const base = Object.keys(ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!base) return true;
  return hasPermission(role, ROUTE_PERMISSIONS[base]);
}

export function getRoleAccessLevels(role: UserRole): Record<RoleAccessArea, RoleAccessLevel> {
  if (hasFullAccess(role)) {
    return {
      treasury: 'full',
      uploads: 'full',
      scenarios: 'full',
      ai: 'full',
      administration: 'full',
    };
  }

  const treasury: RoleAccessLevel = hasPermission(role, 'treasury:read') ? 'view' : 'none';

  let uploads: RoleAccessLevel = 'none';
  if (hasPermission(role, 'uploads:write')) uploads = 'edit';
  else if (hasPermission(role, 'uploads:read')) uploads = 'view';

  let scenarios: RoleAccessLevel = 'none';
  if (hasPermission(role, 'scenarios:write')) scenarios = 'edit';
  else if (hasPermission(role, 'scenarios:read')) scenarios = 'view';

  const ai: RoleAccessLevel = hasPermission(role, 'ai:use') ? 'view' : 'none';

  let administration: RoleAccessLevel = 'none';
  if (hasPermission(role, 'settings:admin')) administration = 'full';
  else if (hasPermission(role, 'settings:profile')) administration = 'view';

  return { treasury, uploads, scenarios, ai, administration };
}

/** Roles shown in the access matrix (owner included for reference). */
export const ACCESS_GUIDE_ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer', 'uploader'];
