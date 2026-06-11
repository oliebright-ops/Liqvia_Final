import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponse, AuthUser, JwtPayload } from './auth.types';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { MailService } from './mail.service';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, we sent password reset instructions.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.userProfile.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.userProfile.create({
      data: {
        email,
        passwordHash,
        name: dto.name,
        role: UserRole.member,
        companyId: null,
        isDemoMode: false,
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.userProfile.findUnique({
      where: { email },
      include: { company: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.userCompanyLink.updateMany({
      where: { userId: user.id },
      data: { email },
    });
    await this.prisma.userCompanyLink.updateMany({
      where: { email, userId: null },
      data: { userId: user.id },
    });

    return this.buildAuthResponse(user);
  }

  async createDemoGuest(): Promise<AuthResponse> {
    const demo = await this.prisma.company.findUnique({
      where: { id: DEFAULT_DEMO_COMPANY_ID },
    });
    if (!demo) {
      throw new NotFoundException('Demo company not found. Run prisma:seed:demo first.');
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    const suffix = randomBytes(6).toString('hex');

    const user = await this.prisma.userProfile.create({
      data: {
        email: `guest.${suffix}@demo.liqvia.local`,
        passwordHash,
        name: 'Demo Explorer',
        isDemoMode: true,
        companyId: DEFAULT_DEMO_COMPANY_ID,
        role: UserRole.viewer,
      },
      include: { company: true },
    });

    return this.buildAuthResponse(user);
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; devResetUrl?: string }> {
    const email = dto.email.toLowerCase().trim();
    if (!email) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const user = await this.prisma.userProfile.findUnique({ where: { email } });
    if (!user || user.isDemoMode || email.endsWith('@demo.liqvia.local')) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = this.buildResetUrl(rawToken);
    const emailSent = await this.mail.sendPasswordResetEmail(email, resetUrl);

    const response: { message: string; devResetUrl?: string } = {
      message: FORGOT_PASSWORD_MESSAGE,
    };

    if (process.env.NODE_ENV !== 'production' && !emailSent) {
      response.devResetUrl = resetUrl;
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const token = dto.token?.trim();
    const password = dto.password;

    if (!token) {
      throw new BadRequestException('Reset token is required');
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const tokenHash = this.hashResetToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await this.prisma.passwordResetToken.delete({ where: { id: record.id } });
      }
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    if (record.user.isDemoMode) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.userProfile.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);

    return { message: 'Password updated. You can sign in with your new password.' };
  }

  async getMe(userId: string): Promise<AuthResponse['user']> {
    const user = await this.prisma.userProfile.findUniqueOrThrow({
      where: { id: userId },
      include: { company: true },
    });
    return this.toAuthUser(user);
  }

  buildAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    companyId: string | null;
    role: UserRole;
    isDemoMode: boolean;
    company?: { name: string; onboardingCompleted: boolean } | null;
  }): AuthResponse {
    const authUser = this.toAuthUser(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      isDemoMode: user.isDemoMode,
    };
    const accessToken = this.jwt.sign(payload);
    return { accessToken, user: authUser };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildResetUrl(rawToken: string): string {
    const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    companyId: string | null;
    role: UserRole;
    isDemoMode: boolean;
    company?: { name: string; onboardingCompleted: boolean } | null;
  }): AuthResponse['user'] {
    const onboardingCompleted = user.isDemoMode
      ? true
      : (user.company?.onboardingCompleted ?? false);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      role: user.role,
      isDemoMode: user.isDemoMode,
      companyName: user.company?.name ?? null,
      onboardingCompleted,
    };
  }
}
