import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: import('@liqvia2/shared').AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Skip CompanyAccessGuard (e.g. workspace switch sends target companyId in body). */
export const SKIP_COMPANY_ACCESS_KEY = 'skipCompanyAccess';
export const SkipCompanyAccess = () => SetMetadata(SKIP_COMPANY_ACCESS_KEY, true);
