/**
 * F60.4 — Política pura da composição da base quadrada.
 *
 * Módulo puro: sem `server-only`, sem processamento de imagem, sem banco,
 * armazenamento, criptografia ou I/O. Papel, formato, dimensão e MIME derivam de
 * `ROLE_POLICY.square_original` (F60.1) — nenhum literal de dimensão é retipado
 * aqui. O tamanho enviado ao provider é um template literal derivado da política.
 *
 * CONTRATO ÚNICO DE TIMEOUT (T-60.4-07): `effectiveTimeout` devolve `null` — e
 * SOMENTE `null` — quando o prazo é não finito ou ≤ 0. A função nunca lança e
 * nunca alonga um prazo menor; prazo inválido recusa a entrada com
 * `timeout_invalid`.
 *
 * ENTRADA (T-60.4-02): o chamador informa apenas identidade, autorização,
 * conteúdo da operação e tentativa. Path, URL, bytes, modelo, qualidade,
 * prompt/prompt base, tamanho e decisão de retry são recusados por presença de
 * chave, antes de qualquer I/O.
 */

import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";

import type { SquareBaseTarget } from "./types";

const TARGET_POLICY = ROLE_POLICY.square_original;

/** Papel do artefato de destino: sempre o quadrado original. */
export const SQUARE_BASE_ROLE = "square_original" as const;

/** Origem F60.1 usada na persistência do quadrado gerado. */
export const SQUARE_BASE_ORIGIN = "provider_generation" as const;

/** Fonte do artefato: geração direta do provider (sem artefato de origem). */
export const SQUARE_BASE_SOURCE = Object.freeze({ kind: "none" as const });

/** Destino: papel, formato, dimensão e MIME derivados da F60.1. */
export const SQUARE_BASE_TARGET = Object.freeze({
  role: SQUARE_BASE_ROLE,
  format: TARGET_POLICY.format,
  width: TARGET_POLICY.width,
  height: TARGET_POLICY.height,
  mimeType: TARGET_POLICY.mimeType,
});

/**
 * Tamanho enviado ao provider (`width x height` da política). Template literal
 * derivado — o literal de dimensão não existe neste módulo.
 */
export const PROVIDER_SIZE: `${number}x${number}` =
  `${SQUARE_BASE_TARGET.width}x${SQUARE_BASE_TARGET.height}`;

/** Teto do prazo de uma chamada paga (nunca alongado pelo chamador). */
export const SQUARE_BASE_TIMEOUT_MS = 180_000 as const;

/** Capability do catálogo reutilizada (sem capability nova nem migration). */
export const SQUARE_BASE_CAPABILITY = "campaign_product_image" as const;

/** Provider exigido na linha ativa do catálogo. */
export const SQUARE_BASE_PROVIDER = "openai" as const;

/** Protocolo exigido na linha ativa do catálogo. */
export const SQUARE_BASE_PROTOCOL = "images" as const;

/** Limite do comprimento da referência opaca de tentativa. */
export const SQUARE_BASE_ATTEMPT_REFERENCE_MAX_LENGTH = 200 as const;

/** Alvos fechados da tentativa F60. */
export const SQUARE_BASE_TARGETS: readonly SquareBaseTarget[] = Object.freeze([
  "primary",
  "fallback",
]);

/** Motivos fechados de entrada recusada antes de qualquer I/O. */
export type SquareBaseInvalidReason =
  | "input_not_object"
  | "store_id_invalid"
  | "campaign_id_invalid"
  | "operation_id_invalid"
  | "authorization_missing"
  | "attempt_number_invalid"
  | "attempt_target_invalid"
  | "attempt_reference_invalid"
  | "product_images_invalid"
  | "identity_image_invalid"
  | "references_invalid"
  | "reference_selections_invalid"
  | "briefing_invalid"
  | "campaign_intent_invalid"
  | "background_direction_invalid"
  | "copy_context_invalid"
  | "timeout_invalid"
  | "path_not_accepted"
  | "url_not_accepted"
  | "bytes_not_accepted"
  | "model_not_accepted"
  | "quality_not_accepted"
  | "prompt_not_accepted"
  | "size_not_accepted"
  | "retry_not_accepted";

export interface ForbiddenKeyGroup {
  readonly reason: Extract<
    SquareBaseInvalidReason,
    | "path_not_accepted"
    | "url_not_accepted"
    | "bytes_not_accepted"
    | "model_not_accepted"
    | "quality_not_accepted"
    | "prompt_not_accepted"
    | "size_not_accepted"
    | "retry_not_accepted"
  >;
  readonly keys: readonly string[];
}

/**
 * Chaves de controle que o chamador NUNCA envia (T-60.4-02). Cada grupo mapeia
 * para um motivo fechado; a presença da chave basta para recusar, mesmo com
 * valor `undefined` (por isso `hasOwnProperty`, não teste de valor).
 */
export const FORBIDDEN_KEY_GROUPS: readonly ForbiddenKeyGroup[] = Object.freeze([
  Object.freeze({
    reason: "path_not_accepted" as const,
    keys: Object.freeze(["storagePath", "path", "bucket", "storageBucket"]),
  }),
  Object.freeze({
    reason: "url_not_accepted" as const,
    keys: Object.freeze(["url", "publicUrl", "signedUrl", "downloadUrl"]),
  }),
  Object.freeze({
    reason: "bytes_not_accepted" as const,
    keys: Object.freeze(["bytes", "imageBase64", "file"]),
  }),
  Object.freeze({
    reason: "model_not_accepted" as const,
    keys: Object.freeze(["model", "modelPrimary", "modelFallback", "modelPair"]),
  }),
  Object.freeze({
    reason: "quality_not_accepted" as const,
    keys: Object.freeze(["quality"]),
  }),
  Object.freeze({
    reason: "prompt_not_accepted" as const,
    keys: Object.freeze(["prompt", "promptBase", "systemPrompt"]),
  }),
  Object.freeze({
    reason: "size_not_accepted" as const,
    keys: Object.freeze(["size", "width", "height"]),
  }),
  Object.freeze({
    reason: "retry_not_accepted" as const,
    keys: Object.freeze(["maxRetries", "retry", "retries", "fallback"]),
  }),
]);

/** União achatada das 26 chaves proibidas (ordem estável, congelada). */
export const SQUARE_BASE_FORBIDDEN_KEYS: readonly string[] = Object.freeze(
  FORBIDDEN_KEY_GROUPS.reduce<string[]>(
    (acc, group) => acc.concat(group.keys),
    [],
  ),
);

/**
 * Prazo efetivo da chamada: `min(prazo do chamador, teto do módulo)`.
 *
 * Sem argumento ⇒ teto. Prazo não finito ou ≤ 0 ⇒ `null` (contrato único de
 * "inválido"); nunca lança e nunca substitui silenciosamente pelo teto.
 */
export function effectiveTimeout(timeoutMs?: number): number | null {
  if (timeoutMs === undefined) return SQUARE_BASE_TIMEOUT_MS;
  if (typeof timeoutMs !== "number") return null;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
  return Math.min(timeoutMs, SQUARE_BASE_TIMEOUT_MS);
}
