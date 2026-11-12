/**
 * F60.4 — Classificação pura de falhas da base quadrada.
 *
 * Módulo puro: sem `server-only`, sem processamento de imagem, sem banco,
 * armazenamento, gateway ou adapter. A decisão de classe NÃO é reimplementada
 * aqui: `classifyProviderFailure` da F60 é a autoridade de
 * transiente/definitiva/desconhecida. Este módulo apenas traduz
 * `AiInvocationError` em uma classificação fechada para o chamador.
 *
 * Regras (T-60.4-14):
 * - `timeout`, `abort` e perda de comunicação após possível envio são SEMPRE
 *   desconhecidas — nunca viram falha definitiva;
 * - `auth`/`quota`/`billing`/`capability`/`content_filter`/entrada 4xx são
 *   definitivas;
 * - `rate_limit`, indisponibilidade/capacidade explícita e falha antes do envio
 *   são transitórias;
 * - saída inválida do provider é definitiva;
 * - a função nunca lança, não agenda nova tentativa e não mantém contador.
 */

import { AiInvocationError } from "@/lib/ai/types";
import { MalformedResponseError } from "@/lib/copy/errors";
import { classifyProviderFailure } from "@/lib/product-9-16-two-stage/two-stage-operation-service";
import type {
  ProviderFailure,
  ProviderFailureReason,
  SendEvidence,
} from "@/lib/product-9-16-two-stage/types";

/** Motivos definitivos fechados devolvidos fora do `ProviderFailure`. */
export const SQUARE_BASE_DEFINITIVE_REASONS = Object.freeze([
  "auth",
  "quota",
  "billing",
  "capability",
  "content_filter",
  "invalid_request",
] as const);

export type SquareBaseDefinitiveReason =
  (typeof SQUARE_BASE_DEFINITIVE_REASONS)[number];

/** Resultado desconhecido: sem retentativa e sem falha definitiva. */
export type SquareBaseUnknownReason = "timeout" | "abort" | "comm_lost";

export type SquareBaseFailureClassification =
  | {
      readonly kind: "provider_failure";
      readonly failure: ProviderFailure & {
        readonly class: "transient" | "definitive";
      };
    }
  | {
      readonly kind: "definitive_failure";
      readonly reason: SquareBaseDefinitiveReason;
    }
  | {
      readonly kind: "unknown_result";
      readonly reason: SquareBaseUnknownReason;
      readonly failure: ProviderFailure & { readonly class: "unknown" };
    };

function definitiveFailure(
  reason: SquareBaseDefinitiveReason,
): SquareBaseFailureClassification {
  return Object.freeze({ kind: "definitive_failure" as const, reason });
}

function unknownResult(
  reason: SquareBaseUnknownReason,
  providerReason: ProviderFailureReason,
  sendEvidence: SendEvidence,
): SquareBaseFailureClassification {
  return Object.freeze({
    kind: "unknown_result" as const,
    reason,
    failure: Object.freeze({
      class: "unknown" as const,
      reason: providerReason,
      sendEvidence,
    }),
  });
}

/**
 * Delega a classe a `classifyProviderFailure` (F60). O ramo desconhecido é
 * defensivo: os motivos usados aqui nunca são classificados como desconhecidos
 * por aquela política.
 */
function providerFailure(
  reason: ProviderFailureReason,
  sendEvidence: SendEvidence,
): SquareBaseFailureClassification {
  const failureClass = classifyProviderFailure({ reason, sendEvidence });
  if (failureClass === "unknown") {
    return unknownResult("comm_lost", reason, sendEvidence);
  }
  return Object.freeze({
    kind: "provider_failure" as const,
    failure: Object.freeze({ class: failureClass, reason, sendEvidence }),
  });
}

function isAbortError(error: unknown): boolean {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

export interface ClassifySquareBaseFailureOptions {
  readonly sendEvidence: SendEvidence;
}

/**
 * Classifica um erro de provider sem lançar e sem decidir repetição. A evidência
 * de envio (`SendEvidence` da F60) é preservada no `ProviderFailure`.
 */
export function classifySquareBaseFailure(
  error: unknown,
  options: ClassifySquareBaseFailureOptions,
): SquareBaseFailureClassification {
  const sendEvidence = options.sendEvidence;

  if (error instanceof AiInvocationError) {
    switch (error.kind) {
      case "timeout":
        return unknownResult("timeout", "timeout", sendEvidence);
      case "network":
        return unknownResult("comm_lost", "comm_lost", sendEvidence);
      case "rate_limit":
        return providerFailure("rate_limit", sendEvidence);
      case "auth":
        return definitiveFailure("auth");
      case "quota":
        return definitiveFailure("quota");
      case "billing":
        return definitiveFailure("billing");
      case "capability":
        return definitiveFailure("capability");
      case "content_filter":
        return definitiveFailure("content_filter");
      case "provider_error": {
        const status = error.httpStatus;
        if (typeof status === "number" && status >= 500) {
          return providerFailure("capacity_unavailable", sendEvidence);
        }
        if (typeof status === "number" && status >= 400) {
          return definitiveFailure("invalid_request");
        }
        if (sendEvidence === "not_sent") {
          return providerFailure("pre_send_failure", sendEvidence);
        }
        return unknownResult("comm_lost", "comm_lost", sendEvidence);
      }
    }
  }

  if (error instanceof MalformedResponseError) {
    return providerFailure("invalid_output", sendEvidence);
  }

  if (isAbortError(error)) {
    return unknownResult("abort", "abort", sendEvidence);
  }

  if (sendEvidence === "not_sent") {
    return providerFailure("pre_send_failure", sendEvidence);
  }

  return unknownResult("comm_lost", "comm_lost", sendEvidence);
}
