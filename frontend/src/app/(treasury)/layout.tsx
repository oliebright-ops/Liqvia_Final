import { RequireAuth } from '@/components/auth/require-auth';
import { RequireOnboarded } from '@/components/auth/require-onboarded';
import { RouteAccessGuard } from '@/components/auth/route-access-guard';
import { TreasuryLayout } from '@/components/layout/treasury-layout';

export default function TreasuryAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireOnboarded>
        <RouteAccessGuard>
          <TreasuryLayout>{children}</TreasuryLayout>
        </RouteAccessGuard>
      </RequireOnboarded>
    </RequireAuth>
  );
}
