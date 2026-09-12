import type { AiCapability, AiModelResolver } from "./model-resolver";
import {
  AiInvocationError,
  normalizeAiError,
  type AiAdapterRegistry,
  type AiCallEnvelope,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "./types";

/** Seleção explícita do alvo pelo orquestrador (o gateway nunca decide). */
export type AiInvocationTarget = "primary" | "fallback";

/**
 * Camada única de invocação de IA (F46, D2/D3/D4).
 *
 * Dependências **injetadas por construtor** (`resolver` + `adapters`); `invoke`
 * **não** recebe o resolver. Executa **uma tentativa** por invocação — sem
 * retry e **sem fallback automático**. O orquestrador aciona o fallback numa
 * segunda `invoke(..., target: "fallback")` explícita.
 *
 * Emite **exatamente um `AiCallEnvelope`** por tentativa real (sucesso, falha ou
 * timeout) via `telemetry.sink`. O gateway **não** persiste e **não** cria run
 * implícito.
 */
export class AiGateway {
  constructor(
    private readonly resolver: AiModelResolver,
    private readonly adapters: AiAdapterRegistry,
  ) {}

  async invoke(
    capability: AiCapability,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
    target: AiInvocationTarget = "primary",
  ): Promise<AiInvocationResult> {
    assertTelemetryContext(telemetry);

    const config = await this.resolver.resolve(capability);
    const selected = target === "fallback" ? config.fallback : config.primary;

    if (!selected) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: `[ai-gateway] fallback não configurado para a capacidade "${capability}"`,
      });
    }

    const adapter = this.adapters.get(selected.protocol);
    if (!adapter) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: `[ai-gateway] adapter não registrado para o protocolo "${selected.protocol}"`,
      });
    }

    const startedAt = Date.now();
    try {
      const result = await adapter.invoke(request, selected);
      await this.emit(telemetry, {
        capability,
        protocol: selected.protocol,
        status: "success",
        provider: selected.provider,
        model: result.model,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        providerReportedCostUsd: result.providerReportedCostUsd,
      });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const normalized = normalizeAiError(err);
      const isInvocationError = normalized instanceof AiInvocationError;
      await this.emit(telemetry, {
        capability,
        protocol: selected.protocol,
        status: isInvocationError && normalized.kind === "timeout" ? "timeout" : "failed",
        provider: selected.provider,
        model: selected.model,
        durationMs,
        errorType: isInvocationError
          ? normalized.kind
          : err instanceof Error
            ? err.name
            : "unknown",
      });
      if (isInvocationError) throw normalized;
      throw err;
    }
  }

  private async emit(telemetry: AiTelemetryContext, envelope: AiCallEnvelope): Promise<void> {
    try {
      await telemetry.sink.emit(envelope);
    } catch (err) {
      // Um sink defeituoso nunca bloqueia a geração (best-effort).
      console.error("[ai-gateway] sink de telemetria falhou (best-effort):", err);
    }
  }
}

function assertTelemetryContext(telemetry: AiTelemetryContext): void {
  if (!telemetry || typeof telemetry !== "object") {
    throw new Error("[ai-gateway] contexto de telemetria é obrigatório");
  }
  if (!telemetry.sink || typeof telemetry.sink.emit !== "function") {
    throw new Error("[ai-gateway] contexto de telemetria exige um sink (AiTelemetrySink)");
  }
}
