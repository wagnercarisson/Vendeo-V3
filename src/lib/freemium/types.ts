import { z } from "zod";
import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";

export const BenefitTypeEnum = z.enum(["onboarding", "monthly", "admin_exception", "demo"]);

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

/**
 * F50.4 — coorte de benefício resolvida externamente (server-side).
 * - `root_legacy`: política legada por raiz (F42/F50.2).
 * - `per_cnpj_f50_4`: política por CNPJ completo (F50.4).
 * Ausente = comportamento legado (compatibilidade com callers existentes).
 */
export type FreemiumPolicyCohort = "root_legacy" | "per_cnpj_f50_4";

export type FreemiumEligibilityInput = {
  cnpj: string;
  storeName: string;
  // D7 — cidade/UF ausentes no formulário são representadas por null.
  // O caller/rota aplica o pré-gate: NUNCA chama o motor com city/state ausentes.
  city: string | null;
  state: string | null;
  segment: string;
  officialData: CnpjLookupData | null;
  lookupOutcome: "resolved" | "not_found" | "unavailable";
  rootHash: string;
  rootEligible: boolean;
  /** F50.4 — coorte resolvida pelo caller; ausente preserva o comportamento legado. */
  policyCohort?: FreemiumPolicyCohort;
  /** F50.4 — elegibilidade por CNPJ completo na coorte `per_cnpj_f50_4`. */
  beneficiaryEligible?: boolean;
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
    beneficiaryEligible?: boolean | null;
    cnaeCompatible: "compatible" | "incompatible" | "unknown" | null;
  };
};
