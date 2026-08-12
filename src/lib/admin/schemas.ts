import { z } from "zod";
import { OPERATION_KEYS } from "@/lib/credit/types";
import { ECONOMIC_PARAMETER_KEYS } from "@/lib/economic/types";

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

/**
 * Query params de GET /api/admin/ai-model-pricing (D8).
 * provider/model filtram a lista; includeHistory="true" traz também as linhas
 * superseded (sem o filtro effective_until IS NULL).
 */
export const AiModelPricingQuerySchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  includeHistory: z.string().optional(),
});

/**
 * Body de PUT /api/admin/ai-model-pricing (D8).
 * reason OBRIGATÓRIO (rastreabilidade); pelo menos uma dimensão de preço
 * (espelha o CHECK chk_ai_model_pricing_at_least_one_price do banco).
 */
export const AiModelPricingUpdateSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    inputCostUsd: z.number().nonnegative().optional(),
    outputCostUsd: z.number().nonnegative().optional(),
    cachedInputCostUsd: z.number().nonnegative().optional(),
    imageUnitCostUsd: z.number().nonnegative().optional(),
    imageTokenCostUsd: z.number().nonnegative().optional(),
    sourceUrl: z.string().url().optional(),
    sourceNote: z.string().optional(),
    reason: z.string().min(1),
  })
  .refine(
    (d) =>
      [
        d.inputCostUsd,
        d.outputCostUsd,
        d.cachedInputCostUsd,
        d.imageUnitCostUsd,
        d.imageTokenCostUsd,
      ].some((v) => v !== undefined),
    { message: "pelo menos um custo" },
  );

/**
 * Query params de GET /api/admin/ai-costs (D10) — repassados ao RPC
 * admin_get_ai_costs (p_*). hours coerced (string→number) com default 24.
 */
export const AiCostsQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  generationType: z.string().optional(),
  operationRunId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  hours: z.coerce.number().int().min(1).default(24),
});

/**
 * Body de PUT /api/admin/economic-parameters (D2).
 * key validado contra ECONOMIC_PARAMETER_KEYS (enum TS versionado);
 * value > 0 (espelha o CHECK value > 0 do banco — T-38.2-15);
 * reason OBRIGATÓRIO (rastreabilidade — audit); operationId opcional
 * para idempotência (retry seguro — T-38.2-16).
 */
export const UpdateEconomicParameterRequestSchema = z.object({
  key: z.enum(ECONOMIC_PARAMETER_KEYS),
  value: z.number().positive("Value deve ser maior que zero"),
  reason: z.string().min(1, "Motivo obrigatório"),
  operationId: z.string().uuid().optional(),
});

/** Segmentos econômicos da entrega (D9) — mesmo enum do service (sem server-only). */
export const OPERATION_RUN_SEGMENTS = [
  "test",
  "freemium/promotional",
  "paid",
  "manual/admin",
  "unknown",
] as const;

/** Limite operacional de janela de período — default ≤ 90d, máximo 365d → 400 (T-38.2-25). */
const MAX_PERIOD_WINDOW_DAYS = 365;

/**
 * Query params de GET /api/admin/ai-operation-runs (D4) — repassados ao
 * OperationRunsService.listRuns. Campos em camelCase (a rota converte de
 * snake_case). Validação de janela: quando periodStart E periodEnd presentes,
 * intervalo > 365 dias → 400 (zod custom); quando ausentes → OK (janela default
 * de 90 dias aplicada no service/RPC).
 */
export const AiOperationRunsQuerySchema = z
  .object({
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    storeId: z.string().uuid().optional(),
    operationRunType: z.string().optional(),
    status: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    generationType: z.string().optional(),
    operationRunId: z.string().uuid().optional(),
    segment: z.enum(OPERATION_RUN_SEGMENTS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .superRefine((data, ctx) => {
    const { periodStart, periodEnd } = data;
    if (periodStart && periodEnd) {
      const diffMs =
        new Date(periodEnd).getTime() - new Date(periodStart).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > MAX_PERIOD_WINDOW_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "janela de período máxima de 365 dias",
          path: ["periodStart"],
        });
      }
    }
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
