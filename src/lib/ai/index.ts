import type { AiCapability } from "./model-resolver";
import { ModelRegistry } from "./model-registry";
import { defaultAdapterRegistry } from "./adapters/registry";
import { AiGateway, type AiInvocationTarget } from "./gateway";
import type { AiInvocationRequest, AiInvocationResult, AiTelemetryContext } from "./types";

/**
 * Ponto único de composição do AI Gateway (F46, D1.1/D2).
 *
 * `defaultAiGateway` é a instância padrão (`ModelRegistry` + 4 adapters). Os
 * serviços migrados chamam `invoke(...)` daqui — nenhum instancia provider.
 * Testes injetam `new AiGateway(resolverFake, adaptersFake)` diretamente.
 */
export const defaultAiGateway = new AiGateway(new ModelRegistry(), defaultAdapterRegistry);

/** Função de conveniência para o caminho de produção (usa a instância padrão). */
export function invoke(
  capability: AiCapability,
  request: AiInvocationRequest,
  telemetry: AiTelemetryContext,
  target: AiInvocationTarget = "primary",
): Promise<AiInvocationResult> {
  return defaultAiGateway.invoke(capability, request, telemetry, target);
}

export { AiGateway } from "./gateway";
export type { AiInvocationTarget, AiInvoker } from "./gateway";
export { defaultAdapterRegistry, createDefaultAdapterRegistry } from "./adapters/registry";
export {
  ModelRegistry,
  MODEL_REGISTRY,
  MODEL_ALLOWLIST,
  CAPABILITY_PROTOCOLS,
  CAPABILITY_SEGMENTS,
  ALL_CAPABILITIES,
} from "./model-registry";
export { CAPABILITY_GENERATION_TYPE } from "./generation-type-map";
export { getApiKey } from "./api-keys";
export {
  DefaultAiTelemetrySink,
  NoopAiTelemetrySink,
  BufferingAiTelemetrySink,
  createDefaultTelemetryContext,
  withOnCallTelemetry,
} from "./telemetry-sink";
export type { AiTelemetrySinkContext } from "./telemetry-sink";
export { withDomainOutcome } from "./domain-outcome";
export type { AiDomainOutcome, AiDomainOutcomeHandle } from "./domain-outcome";
export * from "./types";
export type {
  AiCapability,
  AiProtocol,
  AiProvider,
  AiSegment,
  AiModelTarget,
  AiModelConfig,
  AiModelResolver,
} from "./model-resolver";
