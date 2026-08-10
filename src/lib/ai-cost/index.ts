import "server-only";

// Resolvedor definitivo de custo (D9) — nunca-null, fontes 1-5
export { resolveAiCost } from "./cost-estimator";

// Wrapper legado SÍNCRONO (@deprecated) — contrato F28 preservado até 38-1-07
export { estimateAiCost } from "./legacy-estimator";
export type { AiCostEstimate } from "./legacy-estimator";

// Tipos centrais (D1/D4/D7/D12) — sem server-only
export type {
  CostResolution,
  CostSource,
  TokenUsage,
  AiCallInfo,
  AiCostEvent,
  OperationRunType,
} from "./types";
export { COST_SOURCES, OPERATION_RUN_TYPES } from "./types";

// Camada única de escrita (D7)
export { AiCostTracker } from "./tracker";

// Serviço de preços (D8) — bootstrap + fonte tabela
export { AiModelPricingService, getModelPricing, DEFAULT_AI_MODEL_PRICING } from "./ai-model-pricing";
export type { ModelPricing } from "./ai-model-pricing";
