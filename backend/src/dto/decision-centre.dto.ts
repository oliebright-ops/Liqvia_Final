import { z } from 'zod';
import { DECISION_TYPES } from '../decision-centre/decision-mapping';

export const decisionCentreRequestSchema = z
  .object({
    type: z.enum(DECISION_TYPES),
    amount: z.number().positive().optional(),
    percent: z.number().min(0).max(200).optional(),
    customQuestion: z.string().min(1).max(500).optional(),
    locale: z.string().min(2).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'custom' && !data.customQuestion?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'customQuestion is required when type is "custom"',
        path: ['customQuestion'],
      });
    }
  });

export type DecisionCentreRequestDto = z.infer<typeof decisionCentreRequestSchema>;
