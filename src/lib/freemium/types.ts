import { z } from "zod";

export const BenefitTypeEnum = z.enum(["onboarding", "monthly", "admin_exception"]);

export const FreemiumEntitlementSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid().nullable(),
  root_hash: z.string(),
  benefit_type: BenefitTypeEnum,
  cycle: z.string().nullable(),
  grant_transaction_id: z.string().uuid().nullable(),
  granted_by: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
});

export const FreemiumHistoryQuerySchema = z.object({
  storeId: z.string().optional(),
  rootHash: z.string().optional(),
  benefitType: z.string().optional(),
});

export type FreemiumEntitlement = z.infer<typeof FreemiumEntitlementSchema>;

export type FreemiumStatus = "active" | "used" | "exhausted" | "no_cnpj";
