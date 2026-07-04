import { ObligationCategory, ObligationFrequency } from '@prisma/client';
import { z } from 'zod';

export const createRecurringObligationSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.nativeEnum(ObligationCategory),
  amount: z.number().positive(),
  frequency: z.nativeEnum(ObligationFrequency),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'nextDueDate must be YYYY-MM-DD'),
  notes: z.string().max(2000).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateRecurringObligationDto = z.infer<typeof createRecurringObligationSchema>;

export const updateRecurringObligationSchema = createRecurringObligationSchema.partial();

export type UpdateRecurringObligationDto = z.infer<typeof updateRecurringObligationSchema>;
