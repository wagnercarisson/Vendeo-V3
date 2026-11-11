import "server-only";

/**
 * F60.3 — Transporte single-shot da expansão 1:1 → 9:16.
 *
 * Este módulo é o ÚNICO ponto do expansor que fala com o gateway de IA. Ele
 * monta um `AiGateway` próprio (resolver fixo + registry com apenas o protocolo
 * `images`) sobre o `UpstreamImagesAdapter` com `maxRetries: 0` e
 * `preserveUsageWithoutImage: true`, e o `VerticalImagesAdapter` para medir o
 * `returnedSize` real dos bytes devolvidos.
 *
 * Garantias (T-60.3-09/T-60.3-17/T-60.3-33):
 * - o alvo (`provider`/`model`/`protocol`/`quality`) chega JÁ RESOLVIDO pelo
 *   catálogo; o transporte nunca resolve modelo, nunca monta literal de modelo
 *   e nunca escolhe alvo implícito;
 * - no máximo UMA invocação por chamada de `invokeExpansionOnce`, sem laço, sem
 *   segunda tentativa e sem alvo alternativo;
 * - o loader padrão usa o argumento de credencial do adapter (`getApiKey`) e
 *   fixa `maxRetries: 0` — nenhum retry HTTP oculto do SDK;
 * - o prazo efetivo é `min(prazo do chamador, 180 s)` e o timer é sempre
 *   descartado por `dispose()`, inclusive no sucesso.
 *
 * Regra de arquitetura: nada aqui chama o SDK diretamente, `resolveAiCost` nem
 * `AiCostTracker.record` — o caminho é `AiGateway` + adapters.
 */

import { createOpenAiImagesSdkLoader, UpstreamImagesAdapter } from "@/lib/ai/adapters/upstream-images";
import type { UpstreamImagesSdkLoader } from "@/lib/ai/adapters/upstream-images";
import { AiGateway, type PreparedInvocation } from "@/lib/ai/gateway";
import type { AiCapability, AiModelConfig, AiModelResolver } from "@/lib/ai/model-resolver";
import {
  AiInvocationError,
  type AiAdapter,
  type AiAdapterRegistry,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "@/lib/ai/types";
import { VerticalImagesAdapter } from "@/lib/product-vertical-9-16/telemetry/vertical-images-adapter";

import {
  EXPANSION_CAPABILITY,
  EXPANSION_QUALITY,
  EXPANSION_TIMEOUT_MS,
  PROVIDER_SIZE,
  effectiveTimeout,
} from "./policy";

/** Alvo JÁ RESOLVIDO pelo catálogo (nunca literal de modelo dentro do transporte). */
export interface ExpansionTransportTarget {
  readonly provider: "openai";
  readonly model: string;
  readonly protocol: "images";
  readonly quality: "low";
}

/** Seam de invocação: só `invokePrepared` é substituível (nunca `prepare`). */
export interface ExpansionInvoker {
  invokePrepared(
    prepared: PreparedInvocation,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
  ): Promise<AiInvocationResult>;
}

/** Dependências do transporte: loader do SDK (teste) e invoker (teste). */
export interface ExpansionTransportDeps {
  readonly loadSdk?: UpstreamImagesSdkLoader;
  readonly loadSdkFactory?: () => UpstreamImagesSdkLoader;
  readonly invoker?: ExpansionInvoker;
}

export interface ExpansionTransport {
  readonly target: ExpansionTransportTarget;
  readonly invoker: ExpansionInvoker;
  readonly adapter: AiAdapter;
  prepare(): Promise<PreparedInvocation>;
}

/**
 * Resolver FIXO: uma única capability, um único alvo (o recebido do catálogo).
 * Qualquer outra capability é defeito de programação — nunca um alvo implícito.
 */
class FixedExpansionModelResolver implements AiModelResolver {
  constructor(private readonly target: ExpansionTransportTarget) {}

  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    if (capability !== EXPANSION_CAPABILITY) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: `[vertical-expansion] capacidade não suportada pelo transporte: "${capability}"`,
      });
    }
    return {
      capability: EXPANSION_CAPABILITY,
      segment: "image",
      primary: {
        provider: this.target.provider,
        model: this.target.model,
        protocol: this.target.protocol,
      },
    };
  }

  listCapabilities(): AiCapability[] {
    return [EXPANSION_CAPABILITY];
  }
}

/**
 * Monta o transporte com o alvo resolvido explicitamente. O `AiGateway` é
 * SEMPRE construído aqui; `deps.invoker` substitui apenas `invokePrepared`.
 */
export function createExpansionTransport(
  target: ExpansionTransportTarget,
  deps: ExpansionTransportDeps = {},
): ExpansionTransport {
  const loadSdk =
    deps.loadSdk ??
    (deps.loadSdkFactory ?? (() => createOpenAiImagesSdkLoader({ maxRetries: 0 })))();

  const baseAdapter = new UpstreamImagesAdapter(loadSdk, {
    maxRetries: 0,
    preserveUsageWithoutImage: true,
  });
  const adapter: AiAdapter = new VerticalImagesAdapter(baseAdapter);

  const registry: AiAdapterRegistry = {
    get: (protocol) => (protocol === "images" ? adapter : undefined),
  };

  const gateway = new AiGateway(new FixedExpansionModelResolver(target), registry);

  const invoker: ExpansionInvoker =
    deps.invoker ?? {
      invokePrepared: (prepared, request, telemetry) =>
        gateway.invokePrepared(prepared, request, telemetry),
    };

  return {
    target,
    invoker,
    adapter,
    prepare: () => gateway.prepare(EXPANSION_CAPABILITY, "primary"),
  };
}

/** Evidência de envio de uma única invocação. */
export type ExpansionSendEvidence = "not_sent" | "possibly_sent" | "confirmed_sent";

export type ExpansionOnceOutcome =
  | { readonly result: AiInvocationResult; readonly sendEvidence: "confirmed_sent" }
  | { readonly error: unknown; readonly sendEvidence: "not_sent" | "possibly_sent" };

export interface InvokeExpansionOnceInput {
  readonly invoker: ExpansionInvoker;
  readonly prepared: PreparedInvocation;
  readonly request: AiInvocationRequest;
  readonly telemetry: AiTelemetryContext;
}

/**
 * Valida o request ANTES de qualquer invocação: qualidade `low`, exatamente uma
 * referência (sem imagem de identidade), tamanho do provider e prompt não vazio.
 */
function isValidExpansionRequest(request: AiInvocationRequest): boolean {
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    return false;
  }
  if (request.quality !== EXPANSION_QUALITY) return false;
  if (request.size !== PROVIDER_SIZE) return false;
  if (request.identityImageUrl !== undefined) return false;

  const images = request.productImagesDataUrls;
  if (!Array.isArray(images) || images.length !== 1) return false;
  const only = images[0];
  return typeof only === "string" && only.length > 0;
}

/**
 * Executa NO MÁXIMO uma invocação. Request inválido ⇒ `not_sent` sem chamar.
 * Sucesso ⇒ `confirmed_sent`; erro ⇒ `possibly_sent` (nunca repete).
 */
export async function invokeExpansionOnce(
  input: InvokeExpansionOnceInput,
): Promise<ExpansionOnceOutcome> {
  if (!isValidExpansionRequest(input.request)) {
    return Object.freeze({
      error: new Error("invalid_expansion_request"),
      sendEvidence: "not_sent" as const,
    });
  }

  try {
    const result = await input.invoker.invokePrepared(
      input.prepared,
      input.request,
      input.telemetry,
    );
    return Object.freeze({ result, sendEvidence: "confirmed_sent" as const });
  } catch (error) {
    return Object.freeze({ error, sendEvidence: "possibly_sent" as const });
  }
}

export interface ExpansionAbortHandle {
  readonly signal: AbortSignal;
  timedOut(): boolean;
  dispose(): void;
}

/**
 * Sinal de abort/timeout do módulo. Usa `effectiveTimeout` (teto de 180 s que o
 * chamador só pode encurtar), propaga abort do chamador imediatamente e sempre
 * limpa timer e listener em `dispose()`.
 */
export function createExpansionAbortSignal(
  timeoutMs: number | undefined,
  callerSignal: AbortSignal | undefined,
): ExpansionAbortHandle {
  const limit =
    timeoutMs === undefined ? EXPANSION_TIMEOUT_MS : effectiveTimeout(timeoutMs) ?? EXPANSION_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  let disposed = false;

  const onCallerAbort = (): void => {
    if (disposed) return;
    controller.abort();
  };

  const timer = setTimeout(() => {
    if (disposed) return;
    timedOut = true;
    controller.abort();
  }, limit);

  if (callerSignal !== undefined) {
    if (callerSignal.aborted) {
      onCallerAbort();
    } else {
      callerSignal.addEventListener("abort", onCallerAbort);
    }
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      if (callerSignal !== undefined) {
        callerSignal.removeEventListener("abort", onCallerAbort);
      }
    },
  };
}
