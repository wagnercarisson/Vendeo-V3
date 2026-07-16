import { z } from "zod";

export const CreditTransactionTypeSchema = z.enum([
  "grant",
  "purchase",
  "deduction",
  "refund",
  "adjustment",
]);

export const CreditTransactionSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  type: CreditTransactionTypeSchema,
  amount: z.number().int(),
  balanceBefore: z.number().int(),
  balanceAfter: z.number().int(),
  campaignId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  reference: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});

export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

export interface CreditOperationOptions {
  campaignId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreditBalance {
  storeId: string;
  balance: number;
  updatedAt: string;
}
