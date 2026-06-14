import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/users.dto';

const BCRYPT_ROUNDS = 10;
const ADMIN_ROLES: UserRole[] = [UserRole.admin, UserRole.owner];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listCompanyUsers(companyId: string) {
    return this.prisma.userProfile.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async createUser(actor: AuthUser, dto: CreateUserDto) {
    if (!actor.companyId) {
      throw new ForbiddenException('No company workspace selected');
    }
    if (!ADMIN_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only admins can add company users');
    }

    const companyId = actor.companyId;
    const email = dto.email.toLowerCase();
    const role = dto.role ?? UserRole.member;
    if (role === UserRole.owner) {
      throw new ForbiddenException('Cannot assign owner role via invite');
    }

    const existing = await this.prisma.userProfile.findUnique({ where: { email } });
    if (existing) {
      const linked = await this.prisma.userCompanyLink.findUnique({
        where: { email_companyId: { email, companyId } },
      });
      if (linked) {
        throw new ConflictException('This user is already linked to this entity');
      }

      await this.prisma.userCompanyLink.create({
        data: {
          email,
          companyId,
          userId: existing.id,
          role,
        },
      });

      return {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role,
        createdAt: existing.createdAt,
        linkedExistingAccount: true,
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.userCompanyLink.upsert({
      where: {
        email_companyId: { email, companyId },
      },
      create: {
        email,
        companyId,
        role,
      },
      update: { role },
    });

    const created = await this.prisma.userProfile.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        role,
        companyId,
        createdBy: actor.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await this.prisma.userCompanyLink.updateMany({
      where: { email, companyId },
      data: { userId: created.id },
    });

    return created;
  }
}
