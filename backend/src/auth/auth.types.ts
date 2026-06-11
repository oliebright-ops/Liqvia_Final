import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string | null;
  role: UserRole;
  isDemoMode: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  companyId: string | null;
  role: UserRole;
  isDemoMode: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser & {
    companyName: string | null;
    onboardingCompleted: boolean;
  };
}

export interface CompanyLinkSummary {
  companyId: string;
  companyName: string;
  role: UserRole;
  onboardingCompleted: boolean;
}
