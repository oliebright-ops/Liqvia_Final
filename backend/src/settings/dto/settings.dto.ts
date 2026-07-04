import { AccountType, BusinessMode, UserRole } from '@prisma/client';
import {
  DASHBOARD_WIDGET_KEYS,
  FORECAST_HORIZON_MAX,
  FORECAST_HORIZON_MIN,
  validateReportingPeriod,
} from '@liqvia2/shared';
import { z } from 'zod';

export const updateCompanySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    industry: z.string().max(100).nullable().optional(),
    currency: z.string().length(3).optional(),
    locale: z.string().min(2).max(10).optional(),
    fiscalYearStart: z.number().int().min(1).max(12).optional(),
    forecastHorizonWeeks: z
      .number()
      .int()
      .min(FORECAST_HORIZON_MIN)
      .max(FORECAST_HORIZON_MAX)
      .optional(),
    forecastLookbackWeeks: z.number().int().min(1).max(4).optional(),
    reportingPeriod: z.string().max(16).nullable().optional(),
    periodGranularity: z.enum(['monthly', 'weekly']).optional(),
    businessMode: z.nativeEnum(BusinessMode).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reportingPeriod && data.periodGranularity) {
      const err = validateReportingPeriod(data.reportingPeriod, data.periodGranularity);
      if (err) {
        ctx.addIssue({ code: 'custom', message: err, path: ['reportingPeriod'] });
      }
    }
  });

export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;

export const updateHorizonSchema = z.object({
  forecastHorizonWeeks: z.number().int().min(FORECAST_HORIZON_MIN).max(FORECAST_HORIZON_MAX),
});

export type UpdateHorizonDto = z.infer<typeof updateHorizonSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole).refine((r: UserRole) => r !== UserRole.owner, {
    message: 'Cannot assign owner role via invite',
  }),
});

export type InviteTeamMemberDto = z.infer<typeof inviteTeamMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(UserRole).refine((r: UserRole) => r !== UserRole.owner, {
    message: 'Cannot assign owner role via this endpoint',
  }),
});

export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;

export const chartOfAccountSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  accountType: z.nativeEnum(AccountType),
});

export type ChartOfAccountDto = z.infer<typeof chartOfAccountSchema>;

export const updateChartOfAccountSchema = chartOfAccountSchema.partial();

export type UpdateChartOfAccountDto = z.infer<typeof updateChartOfAccountSchema>;

export const updateDashboardWidgetsSchema = z.object(
  Object.fromEntries(DASHBOARD_WIDGET_KEYS.map((key) => [key, z.boolean()])) as Record<
    (typeof DASHBOARD_WIDGET_KEYS)[number],
    z.ZodBoolean
  >,
);

export type UpdateDashboardWidgetsDto = z.infer<typeof updateDashboardWidgetsSchema>;
