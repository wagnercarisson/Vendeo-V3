import { z } from "zod";
import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";

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

export type Decision = "approved" | "review" | "reject" | "defer";

export type FreemiumEligibilityInput = {
  cnpj: string;
  storeName: string;
  city: string;
  state: string;
  segment: string;
  officialData: CnpjLookupData | null;
  lookupOutcome: "resolved" | "not_found" | "unavailable";
  rootHash: string;
  rootEligible: boolean;
};

export type FreemiumEligibilityOutput = {
  decision: Decision;
  reasons: string[];
  score: number;
  signals: {
    nameSimilarity: number | null;
    cityMatch: boolean | null;
    stateMatch: boolean | null;
    cnpjExists: boolean | null;
    situacaoCadastral: string | null;
    rootEligible: boolean | null;
    cnaeCompatible: boolean | null;
  };
};
