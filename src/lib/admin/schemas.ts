import { z } from "zod";
import { OPERATION_KEYS } from "@/lib/credit/types";
import { ECONOMIC_PARAMETER_KEYS } from "@/lib/economic/types";
import {
  CreateLabEvaluationInputSchema,
  CreateLabExperimentInputSchema,
} from "@/lib/lab/domain/schemas";
import { MAX_REPETITIONS } from "@/lib/lab/limits";

export const GrantCreditsRequestSchema = z.object({
  storeId: z.string().uuid(),
  amount: z.number().int().positive("Amount deve ser maior que zero"),
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid(),
});

export const UpdateOperationCostRequestSchema = z
  .object({
    operationKey: z.enum(OPERATION_KEYS),
    costCredits: z.number().int().min(1),
    reason: z.string().min(1),
    operationId: z.string().uuid().optional(),
  })
  // .strict(): habilitação agora é via feature flags (Controles operacionais) —
  // enviar `enabled` nesta rota é rejeitado (400), não silenciosamente ignorado.
  .strict();

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

const AI_MODEL_CAPABILITIES = [
  "campaign_copy",
  "campaign_correction_analysis",
  "brand_profile_text",
  "campaign_spec",
  "campaign_input_validation",
  "campaign_image_review",
  "brand_profile_vision",
  "visual_signature_validation",
  "campaign_image",
  "campaign_image_edit",
  "visual_signature_image",
] as const;

const AiModelTargetSchema = z
  .object({
    provider: z.enum(["openai", "gemini"]),
    model: z.string().min(1),
    protocol: z.enum(["chat-completions", "responses", "images", "gemini"]),
  })
  .strict();

export const AiModelSelectionUpdateSchema = z
  .object({
    capability: z.enum(AI_MODEL_CAPABILITIES),
    provider: z.enum(["openai", "gemini"]),
    model: z.string().min(1),
    protocol: z.enum(["chat-completions", "responses", "images", "gemini"]),
    fallback: AiModelTargetSchema.nullable().optional(),
    reason: z.string().trim().min(1),
    operationId: z.string().uuid(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.fallback &&
      value.capability !== "campaign_copy"
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fallback"], message: "fallback só é permitido em campaign_copy" });
    }
    if (
      value.fallback &&
      value.provider === value.fallback.provider &&
      value.model === value.fallback.model
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fallback"], message: "primary e fallback devem ser distintos" });
    }
  });

export const AiModelSelectionResetSchema = z
  .object({
    capability: z.enum(AI_MODEL_CAPABILITIES),
    reason: z.string().trim().min(1),
    operationId: z.string().uuid(),
  })
  .strict();

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

// ─── Laboratório de IA (F48.1, D11) ──────────────────────────────────────────
// Schemas da superfície administrativa do laboratório. Anexados ao final do
// arquivo: nenhum schema pré-existente é alterado. As validações de domínio
// (dimensão prompt-only, limites de cenários/repetições, snapshot de prompt)
// vivem em `@/lib/lab/domain/schemas` e são reutilizadas aqui — nunca duplicadas.

/**
 * Criação de experimento prompt-only. Reexporta o schema de domínio do
 * laboratório (48-1-04): nome/objetivo/hipótese, `changedDimension` restrito a
 * `prompt`, alvo de modelo fixo, `params` com `skipInputValidation: true`,
 * `repetitions`/`maxRuns`/`scenarioVersionIds` dentro dos limites travados e
 * `baseline`/`candidate` (prompt oficial × override).
 */
export const LabExperimentCreateRequestSchema = CreateLabExperimentInputSchema;

export type LabExperimentCreateRequest = z.infer<typeof LabExperimentCreateRequestSchema>;

/**
 * Arquivamento administrativo seguro do experimento (F48.2.1, C7). O único
 * payload aceito é `{ status: "archived" }` — `.strict()` recusa qualquer campo
 * adicional, tornando a transição terminal explícita e não ambígua. Nenhuma
 * variante/cenário/run/avaliação é removida.
 */
export const LabExperimentArchiveRequestSchema = z
  .object({ status: z.literal("archived") })
  .strict();

export type LabExperimentArchiveRequest = z.infer<typeof LabExperimentArchiveRequestSchema>;

/**
 * Execução de **um** run. O campo `confirmed` é literalmente `true`, tornando a
 * confirmação explícita parte do contrato (sem ela a rota responde 422 e nenhuma
 * chamada paga é iniciada) e `operationId` UUID é o identificador idempotente.
 */
export const LabRunExecuteRequestSchema = z
  .object({
    variantId: z.string().uuid(),
    scenarioVersionId: z.string().uuid(),
    repetitionIndex: z.number().int().min(1).max(MAX_REPETITIONS),
    supersedesRunId: z.string().uuid().nullable().optional(),
    confirmed: z.literal(true),
    operationId: z.string().uuid(),
  })
  .strict();

export type LabRunExecuteRequest = z.infer<typeof LabRunExecuteRequestSchema>;

/**
 * Registro da avaliação humana. Reexporta o schema de domínio (48-2-1-04), que
 * exige os **runs efetivamente comparados** (`baselineRunId`/`candidateRunId`), a
 * ordem cega opcional e a **rubrica tipada obrigatória** pelos nove critérios
 * (D7) — nunca duplica a validação. A validação de que os runs pertencem ao mesmo
 * experimento/cenário e aos papéis corretos é do serviço de avaliação.
 */
export const LabEvaluationRequestSchema = CreateLabEvaluationInputSchema;

export type LabEvaluationRequest = z.infer<typeof LabEvaluationRequestSchema>;

/**
 * Criação de programa de otimização (D2/D10). O programa agrupa os experimentos
 * de um prompt do Diretor; a autorização de orçamento é um passo **separado**
 * (`LabProgramUpdateRequestSchema`/`authorizeProgramBudget`). `budgetUsd` é
 * opcional na criação — o teto é definido no checkpoint humano.
 */
export const LabProgramCreateRequestSchema = z
  .object({
    matrixVersion: z.string().min(1),
    budgetUsd: z.number().positive().nullable().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type LabProgramCreateRequest = z.infer<typeof LabProgramCreateRequestSchema>;

/**
 * Atualização de programa (D10): status, autorização de orçamento
 * (`budgetUsd` → `budget_usd`/`budget_authorized_by`/`budget_authorized_at`),
 * referência/hash do relatório final e recomendação. Nenhuma promoção automática
 * de variante e nenhuma chamada paga nesta superfície.
 *
 * `close: true` é o campo **explícito** de encerramento/revogação (C3/C4): tem
 * precedência sobre `budgetUsd` — encerrar **nunca** autoriza. Enviar `close` e
 * `budgetUsd` juntos é recusado pela rota com 400 (`invalid_payload`). `status`
 * é mantido por compatibilidade; `status: "closed"` também aciona o encerramento.
 */
export const LabProgramUpdateRequestSchema = z
  .object({
    status: z.enum(["draft", "authorized", "closed"]).optional(),
    close: z.literal(true).optional(),
    budgetUsd: z.number().positive().nullable().optional(),
    finalReportRef: z.string().min(1).optional(),
    finalReportHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    recommendation: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type LabProgramUpdateRequest = z.infer<typeof LabProgramUpdateRequestSchema>;
