import "server-only";

/**
 * F60.4 — Transporte single-shot da base quadrada.
 *
 * Este módulo é o ÚNICO ponto do módulo que fala com o gateway de IA. Ele monta
 * um `AiGateway` próprio (resolver do par congelado + registry com apenas o
 * protocolo `images`) sobre o `UpstreamImagesAdapter` com `maxRetries: 0` e
 * `preserveUsageWithoutImage: true`.
 *
 * Garantias (design D5 / D8 / T-60.4-10 / T-60.4-11 / T-60.4-14):
 * - o alvo (`primary`/`fallback`) chega explícito da F60; o transporte nunca
 *   escolhe fallback, nunca repete e nunca espera entre tentativas;
 * - o loader padrão fixa `maxRetries: 0` — nenhum retry HTTP oculto do SDK;
 * - `preserveUsageWithoutImage: true` — resposta sem imagem preserva `usage`;
 * - o prazo efetivo é `min(prazo do chamador, 180 s)` e o timer é sempre
 *   descartado por `dispose()`, inclusive no sucesso;
 * - request adulterado não chega ao gateway (`assertSquareBaseImageRequest`).
 *
 * Regra de arquitetura: nada aqui chama o SDK diretamente, `resolveAiCost` nem
 * `AiCostTracker.record` — o caminho é `AiGateway` + adapters.
 */

import {
  createOpenAiImagesSdkLoader,
  UpstreamImagesAdapter,
  type UpstreamImagesSdkLoader,
} from "@/lib/ai/adapters/upstream-images";
import { AiGateway, type PreparedInvocation } from "@/lib/ai/gateway";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type { AiCapability } from "@/lib/ai/model-resolver";
import { NewFlowImageModelResolver } from "@/lib/ai/upstream-images-runtime";
import {
  type AiAdapter,
  type AiAdapterRegistry,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "@/lib/ai/types";
import {
  createDeadlineRejection,
  deadlineAt,
} from "@/lib/product-1-1/orchestration/deadline";

import {
  PROVIDER_SIZE,
  SQUARE_BASE_CAPABILITY,
  SQUARE_BASE_TIMEOUT_MS,
  effectiveTimeout,
} from "./policy";

export interface SquareBaseTransportDeps {
  readonly loadSdk?: UpstreamImagesSdkLoader;
  readonly loadSdkFactory?: () => UpstreamImagesSdkLoader;
}

/**
 * Compõe o gateway de imagem do módulo. NÃO reutiliza o gateway 1:1 (que mantém
 * o retry oculto do runtime 1:1).
 */
export function createSquareBaseImageGateway(
  pair: ImageModelPairConfig,
  deps: SquareBaseTransportDeps = {},
): AiGateway {
  const loadSdk =
    deps.loadSdk ??
    (deps.loadSdkFactory ?? (() => createOpenAiImagesSdkLoader({ maxRetries: 0 })))();

  const adapter: AiAdapter = new UpstreamImagesAdapter(loadSdk, {
    maxRetries: 0,
    preserveUsageWithoutImage: true,
  });

  const registry: AiAdapterRegistry = {
    get: (protocol) => (protocol === "images" ? adapter : undefined),
  };

  return new AiGateway(new NewFlowImageModelResolver(pair), registry);
}

/** Motivo fechado de request recusado ANTES de qualquer invocação. */
export type SquareBaseTransportRequestReason =
  | "prompt_missing"
  | "quality_mismatch"
  | "size_mismatch"
  | "product_images_missing"
  | "identity_missing";

export class SquareBaseTransportRequestError extends Error {
  readonly reason: SquareBaseTransportRequestReason;

  constructor(reason: SquareBaseTransportRequestReason) {
    super(`square_base_transport_request_invalid:${reason}`);
    this.name = "SquareBaseTransportRequestError";
    this.reason = reason;
  }
}

function requestError(
  reason: SquareBaseTransportRequestReason,
): SquareBaseTransportRequestError {
  return new SquareBaseTransportRequestError(reason);
}

export interface AssertSquareBaseImageRequestOptions {
  /** Qualidade do alvo congelado do snapshot (nunca um literal do módulo). */
  readonly quality: string;
  /** `true` quando o conteúdo congelado exige imagem de identidade. */
  readonly expectedIdentity: boolean;
}

/**
 * Valida o request antes de qualquer invocação paga. Puro quanto a I/O: nenhum
 * acesso a provider/banco/Storage; violação lança erro com motivo fechado.
 */
export function assertSquareBaseImageRequest(
  request: AiInvocationRequest,
  options: AssertSquareBaseImageRequestOptions,
): void {
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    throw requestError("prompt_missing");
  }
  if (request.quality !== options.quality) {
    throw requestError("quality_mismatch");
  }
  if (request.size !== PROVIDER_SIZE) {
    throw requestError("size_mismatch");
  }

  const images = request.productImagesDataUrls;
  if (
    !Array.isArray(images) ||
    images.length === 0 ||
    images.some((image) => typeof image !== "string" || image.length === 0)
  ) {
    throw requestError("product_images_missing");
  }

  if (
    options.expectedIdentity &&
    (typeof request.identityImageUrl !== "string" ||
      request.identityImageUrl.length === 0)
  ) {
    throw requestError("identity_missing");
  }
}

export interface SquareBaseAbortHandle {
  readonly signal: AbortSignal;
  /** Prazo efetivo aplicado (útil para o deadline da invocação). */
  readonly limitMs: number;
  timedOut(): boolean;
  dispose(): void;
}

/**
 * Sinal de abort/timeout do módulo. Usa `effectiveTimeout` (teto de 180 s que o
 * chamador só pode encurtar), propaga abort do chamador e sempre limpa timer e
 * listener em `dispose()`.
 */
export function createSquareBaseAbortHandle(
  timeoutMs: number | undefined,
  externalSignal: AbortSignal | undefined,
): SquareBaseAbortHandle {
  const limit = effectiveTimeout(timeoutMs) ?? SQUARE_BASE_TIMEOUT_MS;

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

  if (externalSignal !== undefined) {
    if (externalSignal.aborted) {
      onCallerAbort();
    } else {
      externalSignal.addEventListener("abort", onCallerAbort);
    }
  }

  return {
    signal: controller.signal,
    limitMs: limit,
    timedOut: () => timedOut,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      if (externalSignal !== undefined) {
        externalSignal.removeEventListener("abort", onCallerAbort);
      }
    },
  };
}

/** Seam mínimo de gateway: `prepare` + `invokePrepared` (sem re-resolução). */
export interface SquareBaseImageGateway {
  prepare(
    capability: AiCapability,
    target: "primary" | "fallback",
  ): Promise<PreparedInvocation>;
  invokePrepared(
    prepared: PreparedInvocation,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
  ): Promise<AiInvocationResult>;
}

export type SquareBaseSendEvidence =
  | "not_sent"
  | "possibly_sent"
  | "confirmed_sent";

export type SquareBaseOnceOutcome =
  | {
      readonly result: AiInvocationResult;
      readonly prepared: PreparedInvocation;
      readonly sendEvidence: "confirmed_sent";
    }
  | {
      readonly error: unknown;
      readonly prepared: PreparedInvocation | null;
      readonly sendEvidence: "not_sent" | "possibly_sent";
    };

export interface InvokeSquareBaseOnceInput {
  readonly gateway: SquareBaseImageGateway;
  readonly capability: AiCapability;
  readonly target: "primary" | "fallback";
  readonly request: AiInvocationRequest;
  readonly telemetry: AiTelemetryContext;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  /** Qualidade do alvo congelado (validação do request). */
  readonly quality: string;
  /** Identidade exigida pelo conteúdo congelado (validação do request). */
  readonly expectedIdentity: boolean;
}

export interface InvokeSquareBaseOnceDeps {
  readonly clock?: () => number;
}

/**
 * Executa NO MÁXIMO uma invocação, com alvo explícito. Request inválido ou falha
 * de `prepare` ⇒ `not_sent` sem invocar. Sucesso ⇒ `confirmed_sent`. Qualquer
 * erro depois do `prepare` (incluindo deadline/abort) ⇒ `possibly_sent`, sem
 * repetir e sem persistir arte.
 */
export async function invokeSquareBaseOnce(
  input: InvokeSquareBaseOnceInput,
  deps: InvokeSquareBaseOnceDeps = {},
): Promise<SquareBaseOnceOutcome> {
  const clock = deps.clock ?? (() => Date.now());
  const handle = createSquareBaseAbortHandle(input.timeoutMs, input.signal);

  let prepared: PreparedInvocation | null = null;
  let rejection: ReturnType<typeof createDeadlineRejection> | null = null;

  try {
    // (1) Request adulterado nunca chega ao gateway.
    assertSquareBaseImageRequest(input.request, {
      quality: input.quality,
      expectedIdentity: input.expectedIdentity,
    });

    // (2) Alvo explícito preparado UMA vez.
    prepared = await input.gateway.prepare(input.capability, input.target);

    // (3) Uma única invocação, correndo contra o deadline local.
    const now = clock();
    const deadlineAtMs = deadlineAt(now, handle.limitMs);
    rejection = createDeadlineRejection(deadlineAtMs, now);

    const request: AiInvocationRequest = {
      ...input.request,
      signal: handle.signal,
    };

    const result = await Promise.race([
      input.gateway.invokePrepared(prepared, request, input.telemetry),
      rejection.promise,
    ]);

    return Object.freeze({
      result,
      prepared,
      sendEvidence: "confirmed_sent" as const,
    });
  } catch (error) {
    if (prepared === null) {
      return Object.freeze({
        error,
        prepared: null,
        sendEvidence: "not_sent" as const,
      });
    }
    return Object.freeze({
      error,
      prepared,
      sendEvidence: "possibly_sent" as const,
    });
  } finally {
    rejection?.cancel();
    handle.dispose();
  }
}

/** Reexport do contrato de capacidade usada pelo módulo (sem duplicar literal). */
export const SQUARE_BASE_IMAGE_CAPABILITY = SQUARE_BASE_CAPABILITY;
