import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { UsersService } from '../users/users.service';
import {
  ChartOfAccountDto,
  InviteTeamMemberDto,
  UpdateChartOfAccountDto,
  UpdateCompanyDto,
  UpdateProfileDto,
} from './dto/settings.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.admin, UserRole.owner];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      currency: company.currency,
      locale: company.locale,
      fiscalYearStart: company.fiscalYearStart,
      forecastHorizonWeeks: company.forecastHorizonWeeks,
      forecastLookbackWeeks: company.forecastLookbackWeeks,
      reportingPeriod: company.reportingPeriod,
      periodGranularity: company.periodGranularity,
      openingCashBalance: company.openingCashBalance
        ? Number(company.openingCashBalance)
        : null,
      onboardingCompleted: company.onboardingCompleted,
    };
  }

  async updateCompany(actor: AuthUser, dto: UpdateCompanyDto) {
    this.assertAdmin(actor);
    return this.prisma.company.update({
      where: { id: actor.companyId! },
      data: dto,
    });
  }

  async updateForecastHorizon(actor: AuthUser, forecastHorizonWeeks: number) {
    if (!actor.companyId) throw new ForbiddenException('No company workspace');
    const updated = await this.prisma.company.update({
      where: { id: actor.companyId },
      data: { forecastHorizonWeeks },
      select: { forecastHorizonWeeks: true },
    });
    return { forecastHorizonWeeks: updated.forecastHorizonWeeks };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.userProfile.update({
      where: { id: userId },
      data: { name: dto.name },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async listTeam(companyId: string) {
    const links = await this.prisma.userCompanyLink.findMany({
      where: { companyId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return links.map((link) => ({
      id: link.id,
      email: link.email,
      role: link.role,
      userId: link.userId,
      name: link.user?.name ?? link.email.split('@')[0],
      status: link.userId ? 'active' : 'pending',
      createdAt: link.createdAt.toISOString(),
    }));
  }

  async inviteMember(actor: AuthUser, dto: InviteTeamMemberDto) {
    return this.users.createUser(actor, {
      email: dto.email,
      name: dto.name,
      password: dto.password,
      role: dto.role,
    });
  }

  async updateMemberRole(actor: AuthUser, linkId: string, role: UserRole) {
    this.assertAdmin(actor);
    if (role === UserRole.owner) {
      throw new ForbiddenException('Cannot assign owner role via settings');
    }

    const link = await this.prisma.userCompanyLink.findFirst({
      where: { id: linkId, companyId: actor.companyId! },
    });
    if (!link) throw new NotFoundException('Team member not found');
    if (link.role === UserRole.owner) {
      throw new ForbiddenException('Cannot change the owner role');
    }

    const updated = await this.prisma.userCompanyLink.update({
      where: { id: linkId },
      data: { role },
    });

    if (link.userId) {
      await this.prisma.userProfile.updateMany({
        where: { id: link.userId, companyId: actor.companyId! },
        data: { role },
      });
    }

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    };
  }

  async removeMember(actor: AuthUser, linkId: string) {
    this.assertAdmin(actor);
    const link = await this.prisma.userCompanyLink.findFirst({
      where: { id: linkId, companyId: actor.companyId! },
    });
    if (!link) throw new NotFoundException('Team member not found');
    if (link.role === UserRole.owner) {
      throw new ForbiddenException('Cannot remove owner');
    }
    if (link.userId === actor.id) {
      throw new ForbiddenException('Cannot remove yourself');
    }
    await this.prisma.userCompanyLink.delete({ where: { id: linkId } });
    if (link.userId) {
      await this.prisma.userProfile.updateMany({
        where: { id: link.userId, companyId: actor.companyId! },
        data: { companyId: null },
      });
    }
    return { removed: true };
  }

  async listChartOfAccounts(companyId: string, search?: string, type?: AccountType) {
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(type ? { accountType: type } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { code: 'asc' },
    });

    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      accountType: a.accountType,
      status: 'active' as const,
    }));
  }

  async createChartOfAccount(actor: AuthUser, dto: ChartOfAccountDto) {
    this.assertAdmin(actor);
    try {
      return await this.prisma.chartOfAccount.create({
        data: { companyId: actor.companyId!, ...dto },
      });
    } catch {
      throw new ConflictException('Account code already exists');
    }
  }

  async updateChartOfAccount(actor: AuthUser, id: string, dto: UpdateChartOfAccountDto) {
    this.assertAdmin(actor);
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { id, companyId: actor.companyId!, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Account not found');
    return this.prisma.chartOfAccount.update({ where: { id }, data: dto });
  }

  async archiveChartOfAccount(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { id, companyId: actor.companyId!, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Account not found');
    return this.prisma.chartOfAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private assertAdmin(actor: AuthUser) {
    if (!actor.companyId) throw new ForbiddenException('No company workspace');
    if (!ADMIN_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
