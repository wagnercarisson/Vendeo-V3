import type { AiCapability, AiModelResolver, AiModelTarget } from "./model-resolver";
import {
  AiInvocationError,
  normalizeAiError,
  sanitizeEnvelopeMetadata,
  type AiAdapterRegistry,
  type AiCallEnvelope,
  type AiCredentialProvenance,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "./types";

/** Seleção explícita do alvo pelo orquestrador (o gateway nunca decide). */
export type AiInvocationTarget = "primary" | "fallback";

/**
 * Contexto de invocação PREPARADO (pinning) — interno, imutável, vinculado à
 * capacidade/alvo. O gateway prepara capacidade + primary/fallback + provider +
 * modelo + protocolo; a execução reusa esse alvo SEM nova resolução. NÃO contém
 * regra de orçamento (isso é do serviço de gasto) nem entra pelo navegador.
 */
export interface PreparedInvocation {
  readonly capability: AiCapability;
  readonly target: AiInvocationTarget;
  readonly provider: AiModelTarget["provider"];
  readonly model: string;
  readonly protocol: AiModelTarget["protocol"];
  /** Alvo resolvido (interno) — reutilizado na execução SEM nova resolução. */
  readonly resolved: AiModelTarget;
}

/**
 * Seam de invocação injetável (F46-03, D11): `AiGateway` satisfaz esta
 * interface estruturalmente; serviços migrados recebem um `AiInvoker` por
 * construtor (default = `defaultAiGateway`) e testes injetam um fake.
 *
 * `hasFallback` permite ao **orquestrador** decidir se aciona a segunda
 * `invoke(..., target: "fallback")` **sem conhecer o provider** que ocupa o
 * alvo (apenas se ele existe e difere do primary).
 */
export interface AiInvoker {
  invoke(
    capability: AiCapability,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
    target?: AiInvocationTarget,
  ): Promise<AiInvocationResult>;
  hasFallback(capability: AiCapability): Promise<boolean>;
  /**
   * Aditivo (pinning) — prepara uma invocação com alvo resolvido, para execução
   * SEM nova resolução. **Opcional** para preservar fakes legados; quando ausente
   * no piloto, a preparação é tratada como não suportada e BLOQUEIA.
   */
  prepare?(
    capability: AiCapability,
    target?: AiInvocationTarget,
  ): Promise<PreparedInvocation>;
  /** Executa um contexto preparado (sem re-resolver). Emite 1 envelope por tentativa. */
  invokePrepared?(
    prepared: PreparedInvocation,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
  ): Promise<AiInvocationResult>;
}

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

  /**
   * Indica se a capacidade tem um alvo de fallback **configurado e distinto**
   * do primary. Não expõe qual provider ocupa o alvo (o orquestrador decide o
   * gate sem conhecer provider).
   */
  async hasFallback(capability: AiCapability): Promise<boolean> {
    const config = await this.resolver.resolve(capability);
    const fallback = config.fallback;
    if (!fallback) return false;
    return fallback.provider !== config.primary.provider || fallback.model !== config.primary.model;
  }

  /** Prepara (pinning) capacidade + alvo + provider + modelo + protocolo, SEM invocar. */
  async prepare(
    capability: AiCapability,
    target: AiInvocationTarget = "primary",
  ): Promise<PreparedInvocation> {
    const config = await this.resolver.resolve(capability);
    const selected = target === "fallback" ? config.fallback : config.primary;
    if (!selected) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: `[ai-gateway] fallback não configurado para a capacidade "${capability}"`,
      });
    }
    return Object.freeze({
      capability,
      target,
      provider: selected.provider,
      model: selected.model,
      protocol: selected.protocol,
      // Cópia CONGELADA (não a referência original mutável do resolver).
      resolved: Object.freeze({ ...selected }),
    });
  }

  async invoke(
    capability: AiCapability,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
    target: AiInvocationTarget = "primary",
  ): Promise<AiInvocationResult> {
    assertTelemetryContext(telemetry);
    const prepared = await this.prepare(capability, target);
    return this.invokePrepared(prepared, request, telemetry);
  }

  /** Executa o contexto preparado — SEM nova resolução; 1 envelope por tentativa. */
  async invokePrepared(
    prepared: PreparedInvocation,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
  ): Promise<AiInvocationResult> {
    assertTelemetryContext(telemetry);

    const adapter = this.adapters.get(prepared.protocol);
    if (!adapter) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: `[ai-gateway] adapter não registrado para o protocolo "${prepared.protocol}"`,
      });
    }

    const startedAt = Date.now();
    const exposeCredentialScope = telemetry.operationRunType === "brand_profile";
    const sanitizedMetadata = sanitizeEnvelopeMetadata(request.metadata);
    // No perfil, credential_scope é exclusivamente interno. A metadata do
    // caller é removida ANTES de o sink classificar/persistir o evento.
    const requestMetadata =
      exposeCredentialScope && sanitizedMetadata
        ? omitCallerCredentialScope(sanitizedMetadata)
        : sanitizedMetadata;
    const credentialProvenance: AiCredentialProvenance = {};
    try {
      const result = exposeCredentialScope
        ? await adapter.invoke(request, prepared.resolved, credentialProvenance)
        : await adapter.invoke(request, prepared.resolved);
      await this.emit(telemetry, {
        capability: prepared.capability,
        protocol: prepared.protocol,
        status: "success",
        provider: prepared.provider,
        model: result.model,
        usage: result.usage,
        usageMeta: result.usageMeta,
        durationMs: Date.now() - startedAt,
        providerReportedCostUsd: result.providerReportedCostUsd,
        quality: request.quality,
        target: prepared.target,
        attemptNumber: telemetry.attemptNumber,
        ...(requestMetadata ? { metadata: requestMetadata } : {}),
        ...(exposeCredentialScope && credentialProvenance.scope !== undefined
          ? { credentialScope: credentialProvenance.scope }
          : {}),
      });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const normalized = normalizeAiError(err);
      const isInvocationError = normalized instanceof AiInvocationError;
      await this.emit(telemetry, {
        capability: prepared.capability,
        protocol: prepared.protocol,
        status: isInvocationError && normalized.kind === "timeout" ? "timeout" : "failed",
        provider: prepared.provider,
        model: prepared.model,
        durationMs,
        errorType: isInvocationError
          ? normalized.kind
          : err instanceof Error
            ? err.name
            : "unknown",
        quality: request.quality,
        target: prepared.target,
        attemptNumber: telemetry.attemptNumber,
        ...(requestMetadata ? { metadata: requestMetadata } : {}),
        ...(exposeCredentialScope && credentialProvenance.scope !== undefined
          ? { credentialScope: credentialProvenance.scope }
          : {}),
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

function omitCallerCredentialScope(metadata: Record<string, unknown>): Record<string, unknown> {
  const { credential_scope: _callerScope, ...rest } = metadata;
  return rest;
}

function assertTelemetryContext(telemetry: AiTelemetryContext): void {
  if (!telemetry || typeof telemetry !== "object") {
    throw new Error("[ai-gateway] contexto de telemetria é obrigatório");
  }
  if (!telemetry.sink || typeof telemetry.sink.emit !== "function") {
    throw new Error("[ai-gateway] contexto de telemetria exige um sink (AiTelemetrySink)");
  }
}
