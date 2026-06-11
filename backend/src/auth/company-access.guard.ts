import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './auth.types';
import { SKIP_COMPANY_ACCESS_KEY } from './decorators';

/** Ensures route :companyId (or body companyId) matches the authenticated user's active workspace. */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_COMPANY_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params?: { companyId?: string };
      body?: { companyId?: string };
    }>();

    const user = request.user;
    if (!user?.companyId) return true;

    const paramCompanyId = request.params?.companyId;
    if (paramCompanyId && paramCompanyId !== user.companyId) {
      throw new ForbiddenException('Access denied for this company');
    }

    const bodyCompanyId = request.body?.companyId;
    if (bodyCompanyId && bodyCompanyId !== user.companyId) {
      throw new ForbiddenException('Access denied for this company');
    }

    return true;
  }
}
