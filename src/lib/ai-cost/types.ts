import type { GenerationEventType, GenerationEventStatus } from "@/lib/visual-signature/types";

/**
 * Fontes de classificação do custo apurado (D4).
 * Mapeia o CHECK `chk_generation_events_cost_source` do banco (D2).
 * Sem restrição de runtime — importável por zod/UI/route tests.
 */
export const COST_SOURCES = [
  "provider_reported",
  "pricing_table",
  "fallback_static",
  "manual_unknown",
  "not_available",
] as const;

export type CostSource = (typeof COST_SOURCES)[number];

/**
 * Domínios de entrega econômica (D1) — agrupados por `operation_run_id`.
 * `operation_run_type` sem CHECK no banco (padrão do repositório: enums no TS).
 */
export const OPERATION_RUN_TYPES = [
  "campaign_delivery",
  "visual_signature",
  "brand_profile",
  "theme",
] as const;

export type OperationRunType = (typeof OPERATION_RUN_TYPES)[number];

/** Usage normalizado de qualquer provider (D12) — inclui cached/image tokens (D9). */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  imageTokens?: number;
}

/**
 * Resolução de custo de uma chamada (D9/D3).
 * `estimatedCostUsd: null` + `costSource: "not_available"` = custo desconhecido
 * (tokens ainda gravados — D4).
 */
export interface CostResolution {
  estimatedCostUsd: number | null;
  providerReportedCostUsd?: number | null;
  costSource: CostSource;
  /** UUID da linha ai_model_pricing usada | 'code_default' | null (D2/D8) */
  pricingVersion?: string | null;
}

/**
 * Padrão de exposição de usage dos serviços de IA (D7/D12):
 * callback opcional `onCall?: (info: AiCallInfo) => void`.
 */
export interface AiCallInfo {
  provider: string;
  model: string;
  usage?: TokenUsage;
  durationMs: number;
  providerReportedCostUsd?: number | null;
}

/**
 * Contrato único de gravação de um evento de custo (D7) — 1 linha por chamada
 * real de IA. `cost`/`tokens` ausentes = delivery marker (anti-dupla-contagem
 * D1/D6): a entrega não grava custo nem tokens.
 */
export interface AiCostEvent {
  operationRunId: string;
  operationRunType: OperationRunType;
  traceId: string;
  storeId: string;
  userId?: string | null;
  campaignId?: string | null;
  visualSignatureId?: string | null;
  themeId?: string | null;
  generationType: GenerationEventType; // D5 — NÃO duplicar o enum aqui
  provider: string;
  model: string;
  attemptNumber: number;
  durationMs: number;
  status: GenerationEventStatus;
  errorType?: string | null;
  tokens?: TokenUsage;
  cost?: CostResolution;
  metadata?: Record<string, unknown>;
}
