import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-only-change-in-production',
    });
  }

  async validate(_payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.userProfile.findUnique({
      where: { id: _payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      role: user.role,
      isDemoMode: user.isDemoMode,
    };
  }
}
