/**
 * F60.3 — Política pura da expansão por IA 1:1 → 9:16.
 *
 * Módulo puro: sem dependência de servidor, sem processamento de imagem, sem
 * banco/armazenamento, sem criptografia e sem I/O. Todos os papéis, formatos,
 * dimensões e MIME derivam de `ROLE_POLICY` (F60.1) e de `PROVIDER_SIZE` (F59);
 * nada é retipado como literal solto aqui.
 *
 * CONTRATO ÚNICO DE TIMEOUT (T-60.3-06): `effectiveTimeout` devolve `null` — e
 * SOMENTE `null` — quando o prazo é não finito ou ≤ 0. A função nunca lança e
 * nunca cai silenciosamente no teto quando o chamador enviou um prazo inválido:
 * o prazo inválido recusa a entrada com `timeout_invalid`.
 *
 * ENTRADA (T-60.3-01/T-60.3-02): o chamador informa apenas identidade de
 * origem, operação de destino, tentativa e autorização derivada no servidor.
 * Path, URL, bytes, modelo, qualidade, prompt e tamanho são recusados por
 * `hasOwnProperty`, antes de qualquer I/O.
 */

import {
  isArtifactUuid,
  validateAuthorizationContext,
} from "@/lib/campaign/composition-artifacts/identity";
import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";
import { PROVIDER_SIZE } from "@/lib/product-vertical-9-16/dimensions";

import type { ExpandVerticalInput, ExpansionInvalidReason } from "./types";

export { PROVIDER_SIZE };

const SOURCE_POLICY = ROLE_POLICY.square_prepared;
const TARGET_POLICY = ROLE_POLICY.vertical;

/** Papel da fonte: sempre o quadrado preparado da F60.2. */
export const SOURCE_ROLE = "square_prepared" as const;

/** Papel do artefato de destino: vertical 9:16. */
export const DESTINATION_ROLE = "vertical" as const;

/** Fonte exigida: papel `square_prepared`, 1:1, JPEG (dimensão vem da F60.1). */
export const EXPANSION_SOURCE = Object.freeze({
  role: SOURCE_ROLE,
  format: SOURCE_POLICY.format,
  width: SOURCE_POLICY.width,
  height: SOURCE_POLICY.height,
  mimeType: SOURCE_POLICY.mimeType,
});

/** Destino: papel `vertical`, 9:16, JPEG (dimensão vem da F60.1). */
export const EXPANSION_TARGET = Object.freeze({
  role: DESTINATION_ROLE,
  format: TARGET_POLICY.format,
  width: TARGET_POLICY.width,
  height: TARGET_POLICY.height,
  mimeType: TARGET_POLICY.mimeType,
});

/** Origem F60.1 usada na persistência do vertical expandido. */
export const EXPANSION_ORIGIN = "ai_expansion" as const;

/** Qualidade fixa desta fatia (validada contra a lista fechada da F56.1). */
export const EXPANSION_QUALITY = "low" as const;

/** Etapa de telemetria/custo correlacionada com a base 1:1. */
export const EXPANSION_STAGE = "expansion" as const;

/** Teto do prazo de uma chamada paga (nunca alongado pelo chamador). */
export const EXPANSION_TIMEOUT_MS = 180_000 as const;

/** Capability do catálogo reutilizada (sem capability nova nem migration). */
export const EXPANSION_CAPABILITY = "campaign_product_image" as const;

/** Provider exigido na linha ativa do catálogo. */
export const EXPANSION_PROVIDER = "openai" as const;

/** Protocolo exigido na linha ativa do catálogo. */
export const EXPANSION_PROTOCOL = "images" as const;

/** Modelo esperado nesta fatia; o identificador efetivo vem da linha do catálogo. */
export const EXPECTED_MODEL = "gpt-image-2.5-sunburst" as const;

/** Versão do prompt estático (mesmo literal de `prompt.ts`). */
export const EXPANSION_PROMPT_VERSION = "f60.3-expand-9-16-v1" as const;

/** Limite do comprimento da referência opaca de tentativa. */
export const EXPANSION_ATTEMPT_REFERENCE_MAX_LENGTH = 200 as const;

interface ForbiddenKeyGroup {
  readonly reason: ExpansionInvalidReason;
  readonly keys: readonly string[];
}

/**
 * Chaves de controle que o chamador NUNCA envia (T-60.3-01). Cada grupo mapeia
 * para um motivo fechado; a presença da chave basta para recusar, mesmo com
 * valor `undefined` (por isso `hasOwnProperty`, não teste de valor).
 */
const FORBIDDEN_KEY_GROUPS: readonly ForbiddenKeyGroup[] = Object.freeze([
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
    keys: Object.freeze(["bytes", "imageBase64"]),
  }),
  Object.freeze({
    reason: "model_not_accepted" as const,
    keys: Object.freeze(["model", "modelPrimary", "modelFallback"]),
  }),
  Object.freeze({
    reason: "quality_not_accepted" as const,
    keys: Object.freeze(["quality"]),
  }),
  Object.freeze({
    reason: "prompt_not_accepted" as const,
    keys: Object.freeze(["prompt"]),
  }),
  Object.freeze({
    reason: "size_not_accepted" as const,
    keys: Object.freeze(["size"]),
  }),
]);

/** União achatada das 16 chaves proibidas (ordem estável, congelada). */
export const EXPANSION_FORBIDDEN_KEYS: readonly string[] = Object.freeze(
  FORBIDDEN_KEY_GROUPS.reduce<string[]>(
    (acc, group) => acc.concat(group.keys),
    [],
  ),
);

export type ExpandVerticalParseResult =
  | { readonly ok: true; readonly input: ExpandVerticalInput }
  | { readonly ok: false; readonly reason: ExpansionInvalidReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function invalidInput(reason: ExpansionInvalidReason): ExpandVerticalParseResult {
  return Object.freeze({ ok: false as const, reason });
}

/**
 * Prazo efetivo da chamada: `min(prazo do chamador, teto do módulo)`.
 *
 * Sem argumento ⇒ teto. Prazo não finito ou ≤ 0 ⇒ `null` (contrato único de
 * "inválido"); nunca lança e nunca substitui silenciosamente pelo teto.
 */
export function effectiveTimeout(timeoutMs?: number): number | null {
  if (timeoutMs === undefined) return EXPANSION_TIMEOUT_MS;
  if (typeof timeoutMs !== "number") return null;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
  return Math.min(timeoutMs, EXPANSION_TIMEOUT_MS);
}

/**
 * Lê e valida a entrada do chamador sem executar I/O. Qualquer campo que
 * decidiria gasto, modelo, qualidade, prompt, tamanho ou localização é
 * recusado com motivo fechado.
 */
export function parseExpandVerticalInput(raw: unknown): ExpandVerticalParseResult {
  if (!isRecord(raw)) return invalidInput("input_not_object");

  for (const group of FORBIDDEN_KEY_GROUPS) {
    if (group.keys.some((key) => hasOwn(raw, key))) {
      return invalidInput(group.reason);
    }
  }

  const rawSource = raw.source;
  if (!isRecord(rawSource)) return invalidInput("source_identity_invalid");

  const sourceStoreId = rawSource.storeId;
  const sourceCampaignId = rawSource.campaignId;
  const sourceOperationId = rawSource.operationId;

  if (
    !isArtifactUuid(sourceStoreId) ||
    !isArtifactUuid(sourceCampaignId) ||
    !isArtifactUuid(sourceOperationId)
  ) {
    return invalidInput("source_identity_invalid");
  }

  if (rawSource.role !== SOURCE_ROLE) {
    return invalidInput("source_role_not_prepared");
  }

  const destinationOperationId = raw.operationId;
  if (!isArtifactUuid(destinationOperationId)) {
    return invalidInput("operation_id_invalid");
  }

  const rawAttempt = raw.attempt;
  if (!isRecord(rawAttempt)) return invalidInput("attempt_number_invalid");

  const attemptNumber = rawAttempt.number;
  if (
    typeof attemptNumber !== "number" ||
    !Number.isInteger(attemptNumber) ||
    attemptNumber < 1
  ) {
    return invalidInput("attempt_number_invalid");
  }

  const attemptReference = rawAttempt.reference;
  if (
    typeof attemptReference !== "string" ||
    attemptReference.length === 0 ||
    attemptReference.length > EXPANSION_ATTEMPT_REFERENCE_MAX_LENGTH ||
    attemptReference !== attemptReference.trim()
  ) {
    return invalidInput("attempt_reference_invalid");
  }

  const authorizationResult = validateAuthorizationContext(raw.authorization);
  if (!authorizationResult.ok) return invalidInput("authorization_missing");

  const rawTimeoutMs = hasOwn(raw, "timeoutMs") ? raw.timeoutMs : undefined;
  const timeoutMs = effectiveTimeout(rawTimeoutMs as number | undefined);
  if (timeoutMs === null) return invalidInput("timeout_invalid");

  const rawSignal = raw.signal;
  const signal =
    rawSignal === undefined || rawSignal === null
      ? undefined
      : (rawSignal as AbortSignal);

  return Object.freeze({
    ok: true as const,
    input: Object.freeze({
      source: Object.freeze({
        storeId: sourceStoreId.toLowerCase(),
        campaignId: sourceCampaignId.toLowerCase(),
        operationId: sourceOperationId.toLowerCase(),
        role: SOURCE_ROLE,
      }),
      operationId: destinationOperationId.toLowerCase(),
      attempt: Object.freeze({
        number: attemptNumber,
        reference: attemptReference,
      }),
      authorization: authorizationResult.authorization,
      timeoutMs,
      ...(signal === undefined ? {} : { signal }),
    }),
  });
}
