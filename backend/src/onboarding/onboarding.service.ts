import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { AuthService } from '../auth/auth.service';
import { AuthResponse, AuthUser } from '../auth/auth.types';
import {
  AddEntityDto,
  OnboardingCreateCompanyDto,
  SelectCompanyDto,
} from './dto/onboarding.dto';

const BCRYPT_ROUNDS = 10;
const ADMIN_ROLES: UserRole[] = [UserRole.admin, UserRole.owner];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly treasury: TreasuryEngineService,
  ) {}

  async getContext(userId: string) {
    const user = await this.prisma.userProfile.findUniqueOrThrow({
      where: { id: userId },
      include: { company: true },
    });

    await this.repairUserCompanyLinks(user);
    const companyLinks = await this.listCompanyLinksForUser(user.id, user.email);

    const needsWorkspace = !user.companyId && !user.isDemoMode;
    const phase = this.resolvePhase(user, companyLinks.length);

    return {
      needsWorkspace,
      phase,
      isDemoMode: user.isDemoMode,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      onboardingCompleted: user.isDemoMode
        ? true
        : (user.company?.onboardingCompleted ?? false),
      companyLinks,
    };
  }

  async selectCompany(user: AuthUser, dto: SelectCompanyDto): Promise<AuthResponse> {
    const link = await this.findAccessibleCompanyLink(user.id, user.email, dto.companyId);
    if (!link) {
      throw new ForbiddenException(
        'You do not have access to this entity. Ask an owner or admin to grant you access in Settings → Team.',
      );
    }

    const updated = await this.prisma.userProfile.update({
      where: { id: user.id },
      data: {
        companyId: dto.companyId,
        role: link.role,
        isDemoMode: false,
      },
      include: { company: true },
    });

    await this.prisma.userCompanyLink.update({
      where: { id: link.id },
      data: { userId: user.id, email: this.normalizeEmail(user.email) },
    });

    return this.auth.buildAuthResponse(updated);
  }

  async enableDemoMode(user: AuthUser): Promise<AuthResponse> {
    const demo = await this.prisma.company.findUnique({
      where: { id: DEFAULT_DEMO_COMPANY_ID },
    });
    if (!demo) {
      throw new NotFoundException(
        'Demo company not found. Run prisma:seed:demo first.',
      );
    }

    const updated = await this.prisma.userProfile.update({
      where: { id: user.id },
      data: {
        isDemoMode: true,
        companyId: DEFAULT_DEMO_COMPANY_ID,
        role: UserRole.viewer,
      },
      include: { company: true },
    });

    return this.auth.buildAuthResponse(updated);
  }

  async createCompany(
    user: AuthUser,
    dto: OnboardingCreateCompanyDto,
  ): Promise<AuthResponse> {
    if (user.companyId && !user.isDemoMode) {
      throw new ConflictException('You already have an active company workspace');
    }

    const teamEmails = (dto.teamMembers ?? []).map((m) => m.email.toLowerCase());
    if (teamEmails.includes(user.email)) {
      throw new ConflictException('Your email cannot appear in team members');
    }
    if (new Set(teamEmails).size !== teamEmails.length) {
      throw new ConflictException('Duplicate emails in team members');
    }

    const asOfDate = new Date().toISOString().slice(0, 10);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.company.name,
          industry: dto.company.industry,
          currency: dto.company.currency,
          locale: dto.company.locale ?? 'en',
          fiscalYearStart: dto.company.fiscalYearStart,
          forecastHorizonWeeks: dto.company.forecastHorizonWeeks,
          openingCashBalance: dto.company.openingCashBalance,
          onboardingCompleted: false,
        },
      });

      await tx.userCompanyLink.create({
        data: {
          email: this.normalizeEmail(user.email),
          companyId: company.id,
          userId: user.id,
          role: UserRole.owner,
        },
      });

      const bankAccount = await tx.bankAccount.create({
        data: {
          companyId: company.id,
          name: 'Primary Operating Account',
          accountNumberMasked: '****0001',
          currency: dto.company.currency,
        },
      });

      await tx.cashMovement.create({
        data: {
          companyId: company.id,
          bankAccountId: bankAccount.id,
          movementDate: new Date(asOfDate),
          amount: dto.company.openingCashBalance,
          isInflow: dto.company.openingCashBalance >= 0,
          description: 'Opening cash balance',
        },
      });

      for (const member of dto.teamMembers ?? []) {
        const email = member.email.toLowerCase();
        const role =
          member.role === 'admin'
            ? UserRole.admin
            : member.role === 'viewer'
              ? UserRole.viewer
              : UserRole.member;

        await tx.userCompanyLink.upsert({
          where: { email_companyId: { email, companyId: company.id } },
          create: { email, companyId: company.id, role },
          update: { role },
        });

        if (member.password) {
          const existing = await tx.userProfile.findUnique({ where: { email } });
          if (!existing) {
            const passwordHash = await bcrypt.hash(member.password, BCRYPT_ROUNDS);
            const created = await tx.userProfile.create({
              data: {
                email,
                name: member.name,
                passwordHash,
                role,
                companyId: company.id,
                createdBy: user.id,
              },
            });
            await tx.userCompanyLink.updateMany({
              where: { email, companyId: company.id },
              data: { userId: created.id },
            });
          }
        }
      }

      return tx.userProfile.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          role: UserRole.owner,
          isDemoMode: false,
        },
        include: { company: true },
      });
    });

    return this.auth.buildAuthResponse(updatedUser);
  }

  async addEntity(user: AuthUser, dto: AddEntityDto): Promise<AuthResponse> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const switchToNew = dto.switchToNew !== false;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          industry: dto.industry ?? 'General',
          currency: dto.currency,
          locale: dto.locale ?? 'en',
          fiscalYearStart: dto.fiscalYearStart,
          forecastHorizonWeeks: dto.forecastHorizonWeeks,
          openingCashBalance: dto.openingCashBalance,
          onboardingCompleted: false,
        },
      });

      await tx.userCompanyLink.create({
        data: {
          email: this.normalizeEmail(user.email),
          companyId: company.id,
          userId: user.id,
          role: UserRole.owner,
        },
      });

      const bankAccount = await tx.bankAccount.create({
        data: {
          companyId: company.id,
          name: 'Primary Operating Account',
          accountNumberMasked: '****0001',
          currency: dto.currency,
        },
      });

      if (dto.openingCashBalance !== 0) {
        await tx.cashMovement.create({
          data: {
            companyId: company.id,
            bankAccountId: bankAccount.id,
            movementDate: new Date(asOfDate),
            amount: Math.abs(dto.openingCashBalance),
            isInflow: dto.openingCashBalance >= 0,
            description: 'Opening cash balance',
          },
        });
      }

      if (switchToNew) {
        return tx.userProfile.update({
          where: { id: user.id },
          data: {
            companyId: company.id,
            role: UserRole.owner,
            isDemoMode: false,
          },
          include: { company: true },
        });
      }

      return tx.userProfile.findUniqueOrThrow({
        where: { id: user.id },
        include: { company: true },
      });
    });

    return this.auth.buildAuthResponse(updatedUser);
  }

  async getStatus(userId: string) {
    const user = await this.prisma.userProfile.findUniqueOrThrow({
      where: { id: userId },
      include: { company: true },
    });
    if (!user.companyId || !user.company) {
      throw new NotFoundException('No company workspace selected');
    }
    return {
      onboardingCompleted: user.company.onboardingCompleted,
      company: {
        id: user.company.id,
        name: user.company.name,
        industry: user.company.industry,
        currency: user.company.currency,
        fiscalYearStart: user.company.fiscalYearStart,
        forecastHorizonWeeks: user.company.forecastHorizonWeeks,
        openingCashBalance: user.company.openingCashBalance
          ? Number(user.company.openingCashBalance)
          : null,
        locale: user.company.locale,
      },
    };
  }

  async getPreview(user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('No company workspace selected');
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
    });

    const [users, batches] = await Promise.all([
      this.prisma.userProfile.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, role: true },
      }),
      this.prisma.uploadBatch.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          templateType: true,
          fileName: true,
          status: true,
          rowCount: true,
          createdAt: true,
        },
      }),
    ]);

    const completedTemplates = new Set(
      batches.filter((b) => b.status === 'completed').map((b) => b.templateType),
    );

    return {
      company: {
        name: company.name,
        industry: company.industry,
        currency: company.currency,
        fiscalYearStart: company.fiscalYearStart,
        forecastHorizonWeeks: company.forecastHorizonWeeks,
        openingCashBalance: company.openingCashBalance
          ? Number(company.openingCashBalance)
          : null,
      },
      users,
      uploads: batches,
      completedTemplateCount: completedTemplates.size,
      recommendedTemplates: [
        'trial_balance',
        'bank_balances',
        'ar_ageing',
        'ap_ageing',
        'budget',
      ],
    };
  }

  async complete(user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('No company workspace selected');
    }
    if (user.isDemoMode) {
      throw new ForbiddenException('Cannot complete onboarding in demo mode');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only admins can complete onboarding');
    }

    await this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    });

    await this.treasury.generateForCompany(user.companyId, true);

    return { success: true, onboardingCompleted: true };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async repairUserCompanyLinks(user: {
    id: string;
    email: string;
    companyId: string | null;
    role: UserRole;
  }) {
    const email = this.normalizeEmail(user.email);

    await this.prisma.userCompanyLink.updateMany({
      where: { userId: user.id },
      data: { email },
    });

    await this.prisma.userCompanyLink.updateMany({
      where: { email, userId: null },
      data: { userId: user.id },
    });

    if (user.companyId) {
      await this.prisma.userCompanyLink.upsert({
        where: {
          email_companyId: { email, companyId: user.companyId },
        },
        create: {
          email,
          companyId: user.companyId,
          userId: user.id,
          role: user.role,
        },
        update: {
          userId: user.id,
        },
      });
    }

    const links = await this.prisma.userCompanyLink.findMany({
      where: { OR: [{ userId: user.id }, { email }] },
    });

    for (const link of links) {
      const [ownerCount, memberCount] = await Promise.all([
        this.prisma.userCompanyLink.count({
          where: { companyId: link.companyId, role: UserRole.owner },
        }),
        this.prisma.userCompanyLink.count({ where: { companyId: link.companyId } }),
      ]);

      const shouldPromoteToOwner =
        link.userId === user.id &&
        link.role !== UserRole.owner &&
        (ownerCount === 0 || memberCount === 1);

      if (shouldPromoteToOwner) {
        await this.prisma.userCompanyLink.update({
          where: { id: link.id },
          data: { role: UserRole.owner, userId: user.id, email },
        });
        if (user.companyId === link.companyId) {
          await this.prisma.userProfile.update({
            where: { id: user.id },
            data: { role: UserRole.owner },
          });
        }
      }
    }
  }

  private async findAccessibleCompanyLink(userId: string, email: string, companyId: string) {
    const profile = await this.prisma.userProfile.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, companyId: true, role: true },
    });

    await this.repairUserCompanyLinks(profile);

    const normalizedEmail = this.normalizeEmail(profile.email);
    return this.prisma.userCompanyLink.findFirst({
      where: {
        companyId,
        OR: [{ email: normalizedEmail }, { userId }],
      },
      include: { company: true },
    });
  }

  private async listCompanyLinksForUser(userId: string, email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const links = await this.prisma.userCompanyLink.findMany({
      where: {
        OR: [{ email: normalizedEmail }, { userId }],
      },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });

    const byCompanyId = new Map<
      string,
      {
        companyId: string;
        companyName: string;
        role: UserRole;
        onboardingCompleted: boolean;
      }
    >();

    for (const link of links) {
      if (byCompanyId.has(link.companyId)) continue;
      byCompanyId.set(link.companyId, {
        companyId: link.companyId,
        companyName: link.company.name,
        role: link.role,
        onboardingCompleted: link.company.onboardingCompleted,
      });
    }

    return [...byCompanyId.values()];
  }

  private resolvePhase(
    user: { companyId: string | null; isDemoMode: boolean; company?: { onboardingCompleted: boolean } | null },
    linkCount: number,
  ): string {
    if (user.isDemoMode || user.company?.onboardingCompleted) {
      return 'complete';
    }
    if (user.companyId && !user.company?.onboardingCompleted) {
      return 'setup';
    }
    if (linkCount > 0) {
      return 'select';
    }
    return 'welcome';
  }
}
