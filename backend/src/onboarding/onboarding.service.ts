import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { isDemoGuestEnabled } from '../demo/demo-access';
import { PrismaService } from '../prisma/prisma.service';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';
import { AuthService } from '../auth/auth.service';
import { AuthResponse, AuthUser } from '../auth/auth.types';
import { AddEntityDto, OnboardingCreateCompanyDto, OnboardingBankAccountDto, SelectCompanyDto } from './dto/onboarding.dto';

const BCRYPT_ROUNDS = 10;
const ADMIN_ROLES: UserRole[] = [UserRole.admin, UserRole.owner];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly treasury: TreasuryEngineService,
    private readonly bankAccounts: BankAccountsService,
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
      onboardingCompleted: user.isDemoMode ? true : (user.company?.onboardingCompleted ?? false),
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
    if (!isDemoGuestEnabled()) {
      throw new ForbiddenException('Demo access is currently unavailable');
    }

    const demo = await this.prisma.company.findUnique({
      where: { id: DEFAULT_DEMO_COMPANY_ID },
    });
    if (!demo) {
      throw new NotFoundException('Demo company not found. Run prisma:seed:demo first.');
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

  async createCompany(user: AuthUser, dto: OnboardingCreateCompanyDto): Promise<AuthResponse> {
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
    const manualBankAccounts = this.normalizeBankAccountInputs(
      dto.company.bankAccounts,
      dto.company.currency,
    );
    const openingCashBalance =
      manualBankAccounts.length > 0
        ? this.sumOpeningBalances(manualBankAccounts)
        : dto.company.openingCashBalance;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.company.name,
          industry: dto.company.industry,
          currency: dto.company.currency,
          locale: dto.company.locale ?? 'en',
          fiscalYearStart: dto.company.fiscalYearStart,
          forecastHorizonWeeks: dto.company.forecastHorizonWeeks,
          openingCashBalance,
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

      await this.seedInitialBankAccounts(tx, company.id, dto.company.currency, asOfDate, {
        bankAccounts: manualBankAccounts.length > 0 ? manualBankAccounts : undefined,
        openingCashBalance: dto.company.openingCashBalance,
      });

      for (const member of dto.teamMembers ?? []) {
        const email = member.email.toLowerCase();
        const role =
          member.role === 'admin'
            ? UserRole.admin
            : member.role === 'viewer'
              ? UserRole.viewer
              : member.role === 'uploader'
                ? UserRole.uploader
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
    const manualBankAccounts = this.normalizeBankAccountInputs(dto.bankAccounts, dto.currency);
    const openingCashBalance =
      manualBankAccounts.length > 0
        ? this.sumOpeningBalances(manualBankAccounts)
        : dto.openingCashBalance;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          industry: dto.industry ?? 'General',
          currency: dto.currency,
          locale: dto.locale ?? 'en',
          fiscalYearStart: dto.fiscalYearStart,
          forecastHorizonWeeks: dto.forecastHorizonWeeks,
          openingCashBalance,
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

      await this.seedInitialBankAccounts(tx, company.id, dto.currency, asOfDate, {
        bankAccounts: manualBankAccounts.length > 0 ? manualBankAccounts : undefined,
        openingCashBalance: dto.openingCashBalance,
      });

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

    const [users, batches, bankSummary] = await Promise.all([
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
      this.bankAccounts.listForCompany(user.companyId),
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
        openingCashBalance: company.openingCashBalance ? Number(company.openingCashBalance) : null,
      },
      users,
      uploads: batches,
      bankAccounts: bankSummary.accounts.map((account) => ({
        name: account.accountName,
        bankName: account.bankName,
        accountNumberMasked: account.accountNumberMasked,
        currency: account.currency,
        openingBalance: account.openingBalance,
        currentBalance: account.currentBalance,
      })),
      completedTemplateCount: completedTemplates.size,
      recommendedTemplates: ['trial_balance', 'bank_balances', 'ar_ageing', 'ap_ageing', 'budget'],
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
    user: {
      companyId: string | null;
      isDemoMode: boolean;
      company?: { onboardingCompleted: boolean } | null;
    },
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

  private normalizeBankAccountInputs(
    accounts: OnboardingBankAccountDto[] | undefined,
    companyCurrency: string,
  ): Array<Required<Pick<OnboardingBankAccountDto, 'name' | 'openingBalance'>> & {
    accountNumberMasked: string;
    currency: string;
  }> {
    return (accounts ?? [])
      .map((account) => ({
        name: account.name?.trim() ?? '',
        accountNumberMasked: account.accountNumberMasked?.trim() || '****0000',
        currency: account.currency?.trim() || companyCurrency,
        openingBalance: Number(account.openingBalance) || 0,
      }))
      .filter((account) => account.name.length > 0);
  }

  private sumOpeningBalances(
    accounts: Array<{ openingBalance: number }>,
  ): number {
    return accounts.reduce((total, account) => total + account.openingBalance, 0);
  }

  private async seedInitialBankAccounts(
    tx: Prisma.TransactionClient,
    companyId: string,
    companyCurrency: string,
    asOfDate: string,
    options: {
      bankAccounts?: Array<{
        name: string;
        accountNumberMasked: string;
        currency: string;
        openingBalance: number;
      }>;
      openingCashBalance?: number;
    },
  ): Promise<void> {
    const rows = options.bankAccounts ?? [];

    if (rows.length > 0) {
      for (const row of rows) {
        const account = await tx.bankAccount.create({
          data: {
            companyId,
            name: row.name,
            accountNumberMasked: row.accountNumberMasked,
            currency: row.currency,
          },
        });

        if (row.openingBalance !== 0) {
          await tx.cashMovement.create({
            data: {
              companyId,
              bankAccountId: account.id,
              movementDate: new Date(asOfDate),
              amount: Math.abs(row.openingBalance),
              isInflow: row.openingBalance >= 0,
              description: 'Opening cash balance',
            },
          });
        }
      }
      return;
    }

    const opening = Number(options.openingCashBalance) || 0;
    const bankAccount = await tx.bankAccount.create({
      data: {
        companyId,
        name: 'Primary Operating Account',
        accountNumberMasked: '****0001',
        currency: companyCurrency,
      },
    });

    if (opening !== 0) {
      await tx.cashMovement.create({
        data: {
          companyId,
          bankAccountId: bankAccount.id,
          movementDate: new Date(asOfDate),
          amount: Math.abs(opening),
          isInflow: opening >= 0,
          description: 'Opening cash balance',
        },
      });
    }
  }
}
