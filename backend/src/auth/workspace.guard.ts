import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from './auth.types';

/** Blocks API access when the user has no active company workspace. */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) return true;
    if (!user.companyId) {
      throw new ForbiddenException('No company workspace selected. Complete onboarding first.');
    }
    return true;
  }
}
