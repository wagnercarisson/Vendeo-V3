import { z } from "zod";
import { OPERATION_KEYS } from "@/lib/credit/types";

export const GrantCreditsRequestSchema = z.object({
  storeId: z.string().uuid(),
  amount: z.number().int().positive("Amount deve ser maior que zero"),
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid(),
});

export const UpdateOperationCostRequestSchema = z
  .object({
    operationKey: z.enum(OPERATION_KEYS),
    costCredits: z.number().int().min(1).optional(),
    enabled: z.boolean().optional(),
    reason: z.string().min(1),
    operationId: z.string().uuid().optional(),
  })
  .refine(
    (v) => (v.costCredits === undefined) !== (v.enabled === undefined),
    {
      message:
        "exatamente um campo mutável por chamada (costCredits XOR enabled)",
    },
  );

export const CreateStoreSchema = z.object({
  userId: z.string().uuid(),
  storeName: z.string().min(1).max(100),
  segment: z.string().min(1).max(50),
});

export interface AdminUserSummary {
  userId: string;
  email: string;
  storeId: string | null;
  storeName: string | null;
  segment: string | null;
  balance: number;
  bonusBalance: number;
  purchasedBalance?: number;
  totalCampaigns: number;
  errorCampaigns: number;
  lastCampaignAt: string | null;
  createdAt: string;
  cnpjMasked: string | null;
  freemiumStatus: "active" | "used" | "exhausted" | "no_cnpj";
}

export interface AdminCampaignError {
  campaignId: string;
  productName: string;
  storeId: string;
  storeName: string;
  userEmail: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  operationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
