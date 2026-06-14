import { z } from 'zod';

export const profileFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
});

export const companyFormSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  industry: z.string().max(100).optional().or(z.literal('')),
  currency: z.string().length(3, 'Use a 3-letter currency code'),
  locale: z.string().min(2).max(10),
  fiscalYearStart: z.coerce.number().int().min(1).max(12),
  forecastHorizonWeeks: z.coerce.number().int().min(1).max(26),
  forecastLookbackWeeks: z.coerce.number().int().min(1).max(4),
  reportingPeriod: z.string().max(16).optional().or(z.literal('')),
  periodGranularity: z.enum(['monthly', 'weekly']),
});

export const inviteFormSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['member', 'viewer', 'admin', 'uploader']),
});

export const entityFormSchema = z.object({
  name: z.string().min(1, 'Entity name is required').max(200),
  industry: z.string().max(100).optional().or(z.literal('')),
  currency: z.string().length(3, 'Use a 3-letter currency code'),
  locale: z.string().min(2).max(10),
  fiscalYearStart: z.coerce.number().int().min(1).max(12),
  forecastHorizonWeeks: z.coerce.number().int().min(1).max(26),
  openingCashBalance: z.coerce.number(),
  switchToNew: z.boolean(),
});

export const coaFormSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type CompanyFormValues = z.infer<typeof companyFormSchema>;
export type InviteFormValues = z.infer<typeof inviteFormSchema>;
export type EntityFormValues = z.infer<typeof entityFormSchema>;
export type CoaFormValues = z.infer<typeof coaFormSchema>;
