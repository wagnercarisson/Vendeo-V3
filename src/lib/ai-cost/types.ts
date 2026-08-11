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

/**
 * Usage normalizado de qualquer provider (D12) — inclui cached/image tokens (D9).
 * F38.1: breakdown granular da Responses API image_generation (input/output
 * separados em text vs image). Campos opcionais — providers que não expõem os
 * detalhes continuam entregando apenas os campos base.
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  /** SÓ output image tokens (retrocompat D9) — espelha output_tokens_details.image_tokens. */
  imageTokens?: number;
  /** F38.1: input_tokens_details.text_tokens — texto de entrada sem tokens de imagem. */
  inputTextTokens?: number;
  /** F38.1: input_tokens_details.image_tokens — tokens de imagem na entrada (foto do produto). */
  inputImageTokens?: number;
  /** F38.1: output_tokens_details.text_tokens — texto de saída (não inclui a imagem gerada). */
  outputTextTokens?: number;
  /** F38.1: output_tokens_details.image_tokens — tokens de imagem gerada (mesmo valor de imageTokens). */
  outputImageTokens?: number;
}

/**
 * Resolução de custo de uma chamada (D9/D3).
 * `estimatedCostUsd: null` + `costSource: "not_available"` = custo desconhecido
 * (tokens ainda gravados — D4).
 *
 * F38.2 (D5): os campos de confiança — costFormulaVersion, costEstimationNote,
 * textComponentUsd e imageToolComponentUsd — são persistidos pelo
 * AiCostTracker.record em generation_events (colunas cost_formula_version,
 * cost_estimation_note, text_component_usd, image_tool_component_usd), daqui
 * para frente, sem reclassificar histórico.
 */
export interface CostResolution {
  estimatedCostUsd: number | null;
  providerReportedCostUsd?: number | null;
  costSource: CostSource;
  /** UUID da linha ai_model_pricing usada | 'code_default' | null (D2/D8) */
  pricingVersion?: string | null;
  /**
   * F38.1: versão da fórmula usada (auditabilidade). Ex: "responses_image_generation_v2".
   * Presente quando o resolvedor aplica uma fórmula específica (não genérica).
   */
  costFormulaVersion?: string;
  /**
   * F38.1: nota quando a estimativa é parcial/calibrável.
   * Ex: "provisional_image_tool_unit_cost_until_provider_reconciliation" (tool com
   * unit cost provisório) ou "responses_image_generation_tool_without_unit_pricing"
   * (tool sem pricing de unidade configurado — só componente textual).
   */
  costEstimationNote?: string;
  /**
   * F38.1 fechamento — componentes da fórmula responses_image_generation_v2:
   * estimated_cost_usd = text_component_usd + image_tool_component_usd.
   * `textComponentUsd` = custo por tokens do modelo textual/orquestrador.
   * `imageToolComponentUsd` = valor versionável por unidade de imagem da tool
   * (ai_model_pricing, ex: openai/responses:image_generation) — provisório/calibrável,
   * NÃO é custo real e nunca preenche provider_reported_cost_usd.
   */
  textComponentUsd?: number;
  imageToolComponentUsd?: number;
  /** F38.1: origem versionável do componente da tool (provider/model/versionId da linha). */
  imageToolPricingProvider?: string;
  imageToolPricingModel?: string;
  imageToolPricingVersion?: string;
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
