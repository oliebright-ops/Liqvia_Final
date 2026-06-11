export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  role: UserRole;
  isDemoMode: boolean;
  onboardingCompleted: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface CompanyLink {
  companyId: string;
  companyName: string;
  role: UserRole;
  onboardingCompleted: boolean;
}

export interface OnboardingContext {
  needsWorkspace: boolean;
  phase: 'welcome' | 'select' | 'setup' | 'complete';
  isDemoMode: boolean;
  companyId: string | null;
  companyName: string | null;
  onboardingCompleted: boolean;
  companyLinks: CompanyLink[];
}

export function resolvePostAuthPath(user: AuthUser): string {
  if (user.isDemoMode || (user.companyId && user.onboardingCompleted)) {
    return '/dashboard';
  }
  return '/onboarding';
}

export function needsOnboarding(user: AuthUser): boolean {
  if (user.isDemoMode) return false;
  if (!user.companyId) return true;
  return !user.onboardingCompleted;
}
