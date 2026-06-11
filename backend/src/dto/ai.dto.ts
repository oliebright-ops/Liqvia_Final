import { z } from 'zod';

export const aiInsightSchema = z.object({
  companyId: z.string().optional(),
  question: z.string().max(2000).optional(),
});

export type AiInsightDto = z.infer<typeof aiInsightSchema>;

export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

export const aiChatSchema = z.object({
  companyId: z.string().optional(),
  messages: z.array(aiChatMessageSchema).max(10),
});

export type AiChatDto = z.infer<typeof aiChatSchema>;
