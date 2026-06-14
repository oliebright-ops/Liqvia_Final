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

export const ROLE_PERMISSIONS: Record<UserRole, readonly AppPermission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  member: [
    'treasury:read',
    'scenarios:read',
    'scenarios:write',
    'ai:use',
    'uploads:read',
    'settings:profile',
  ],
  viewer: ['treasury:read', 'scenarios:read', 'ai:use', 'settings:profile'],
  uploader: ['uploads:read', 'uploads:write'],
};

export const USER_ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer', 'uploader'];

export const ASSIGNABLE_TEAM_ROLES: UserRole[] = ['admin', 'member', 'viewer', 'uploader'];

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
