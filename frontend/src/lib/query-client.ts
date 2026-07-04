import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const treasurySummaryKey = (companyId: string | null, horizonWeeks?: number) =>
  ['treasury-summary', companyId, horizonWeeks ?? null] as const;

export const freeCashKey = (companyId: string | null, horizonWeeks: number) =>
  ['free-cash', companyId, horizonWeeks] as const;

export const dataQualityKey = (companyId: string | null) =>
  ['data-quality', companyId] as const;

export const notificationsKey = (companyId: string | null) =>
  ['notifications', companyId] as const;

export const businessPulseKey = (companyId: string | null) =>
  ['business-pulse', companyId] as const;
