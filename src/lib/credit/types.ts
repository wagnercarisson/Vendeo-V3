import { z } from "zod";

export const CreditTransactionTypeSchema = z.enum([
  "bonus_onboarding",
  "bonus_monthly",
  "admin_grant",
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
  campaignId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreditBalance {
  storeId: string;
  balance: number;
  bonusBalance: number;
  purchasedBalance: number;
  updatedAt: string;
}

export const OPERATION_KEYS = [
  "campaign_generation",
  "visual_signature_generation",
] as const;

export type OperationKey = (typeof OPERATION_KEYS)[number];

// Labels humanizados (PT-BR) das operações — usados em admin/costs (a key
// técnica permanece como subtexto mono).
export const OPERATION_LABELS: Record<OperationKey, string> = {
  campaign_generation: "Geração de campanha",
  visual_signature_generation: "Geração de assinatura visual",
};

export interface OperationCostResolution {
  operationKey: OperationKey;
  costCredits: number;
  enabled: boolean;
  source: "table" | "fallback";
}

export interface OperationCostSnapshot {
  operation_key: OperationKey;
  operation_cost_credits: number;
  operation_cost_source: "table" | "fallback";
}
