import { ConfidenceLevel, ObligationFrequency, SettlementStatus } from '@prisma/client';
import { z } from 'zod';

export const createExpectedSettlementSchema = z.object({
  source: z.string().min(1).max(200),
  amount: z.number().positive(),
  frequency: z.nativeEnum(ObligationFrequency),
  nextExpectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'nextExpectedDate must be YYYY-MM-DD'),
  destinationAccountId: z.string().nullable().optional(),
  status: z.nativeEnum(SettlementStatus).optional(),
  confidence: z.nativeEnum(ConfidenceLevel).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateExpectedSettlementDto = z.infer<typeof createExpectedSettlementSchema>;

export const updateExpectedSettlementSchema = createExpectedSettlementSchema.partial();

export type UpdateExpectedSettlementDto = z.infer<typeof updateExpectedSettlementSchema>;
