import { AccountPurpose } from '@prisma/client';
import { z } from 'zod';

export const updateBankAccountPurposeSchema = z.object({
  accountPurpose: z.nativeEnum(AccountPurpose),
});

export type UpdateBankAccountPurposeDto = z.infer<typeof updateBankAccountPurposeSchema>;
