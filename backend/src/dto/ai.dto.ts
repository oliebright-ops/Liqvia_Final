import { z } from 'zod';

export const aiInsightSchema = z.object({
  companyId: z.string().optional(),
  question: z.string().max(2000).optional(),
  locale: z.enum(['en', 'es', 'fr', 'ru']).optional(),
  intent: z.string().max(40).optional(),
});

export type AiInsightDto = z.infer<typeof aiInsightSchema>;

export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

export const aiChatSchema = z.object({
  companyId: z.string().optional(),
  locale: z.enum(['en', 'es', 'fr', 'ru']).optional(),
  intent: z.string().max(40).optional(),
  messages: z.array(aiChatMessageSchema).max(10),
});

export type AiChatDto = z.infer<typeof aiChatSchema>;
