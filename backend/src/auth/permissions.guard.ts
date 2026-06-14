import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppPermission, hasAnyPermission } from '@liqvia2/shared';
import { AuthUser } from './auth.types';
import { PERMISSIONS_KEY } from './decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !hasAnyPermission(user.role, required)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
