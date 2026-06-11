import { RequireAuth } from '@/components/auth/require-auth';
import { RequireOnboarded } from '@/components/auth/require-onboarded';
import { TreasuryLayout } from '@/components/layout/treasury-layout';

export default function TreasuryAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireOnboarded>
        <TreasuryLayout>{children}</TreasuryLayout>
      </RequireOnboarded>
    </RequireAuth>
  );
}
