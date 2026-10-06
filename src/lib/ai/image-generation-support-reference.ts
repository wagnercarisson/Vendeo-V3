/**
 * Resposta pública não reveladora + referência de atendimento do novo fluxo de
 * geração de imagem (F56.1, D-18/D-19).
 *
 * Componente **puro** (sem I/O, sem banco, sem provider e sem crédito):
 *
 *  - define o **código público único** `IMG-001` desta fatia. O código NÃO
 *    particiona quota, faturamento, autenticação/autorização nem rate limit —
 *    todas essas causas compartilham a MESMA categoria pública, de modo que não
 *    seja possível inferir o motivo verdadeiro (D-18);
 *  - gera a **referência de atendimento opaca** em **UUID v4** (aleatória, única
 *    por ocorrência, sem dados de conta/credencial e sem derivar da causa);
 *  - monta a **mensagem pública em PT-BR** genérica, aplicando
 *    `sanitizeAiErrorMessage` sobre qualquer texto residual para nunca vazar
 *    chave, URL ou texto cru do provider (D-19).
 *
 * A causa verdadeira é recuperável **somente** pela referência, no admin/suporte,
 * que correlaciona a referência → diagnóstico interno (categoria interna, par
 * modelo–qualidade, tentativa, erro normalizado, run/trace) — ver
 * `image-generation-diagnosis-repository.ts`.
 */

import { randomUUID } from "node:crypto";

import { sanitizeAiErrorMessage } from "./types";

/** Código público estável e único da categoria genérica de falha de geração (D-18). */
export const PUBLIC_GENERATION_FAILURE_CODE = "IMG-001" as const;

/**
 * Conjunto FECHADO de códigos de erro normalizados do diagnóstico interno (D-19).
 *
 * Alinhado a `AiInvocationErrorKind` (`types.ts`) mais a categoria genérica
 * `unknown_provider_error`. É a ÚNICA forma permitida de persistir o
 * `normalized_error`: qualquer valor fora deste conjunto NÃO é gravado — é
 * reduzido a `GENERIC_FAILURE_ERROR_CODE`. Isso impede que o texto cru do
 * provider (chave, URL, stack, mensagem) seja persistido/exibido.
 */
export const NORMALIZED_FAILURE_ERROR_CODES = Object.freeze([
  "timeout",
  "auth",
  "rate_limit",
  "capability",
  "network",
  "content_filter",
  "provider_error",
  "quota",
  "billing",
  "unknown_provider_error",
] as const);

/** Código de erro normalizado pertencente ao conjunto fechado. */
export type NormalizedFailureErrorCode = (typeof NORMALIZED_FAILURE_ERROR_CODES)[number];

/** Valor genérico aplicado a qualquer entrada desconhecida (nunca revela a entrada crua). */
export const GENERIC_FAILURE_ERROR_CODE = "unknown_provider_error" as const;

const NORMALIZED_FAILURE_ERROR_CODE_SET: ReadonlySet<string> = new Set(
  NORMALIZED_FAILURE_ERROR_CODES,
);

/**
 * Mensagem pública genérica em PT-BR (D-19). Deliberadamente NÃO menciona quota,
 * saldo, faturamento, autenticação ou rate limit, e não contém chave/URL/stack
 * nem texto cru do provider.
 */
export const PUBLIC_GENERATION_FAILURE_MESSAGE =
  "Não foi possível gerar a imagem da campanha. Tente novamente em instantes. Se o problema continuar, informe o código IMG-001 e a referência de atendimento ao suporte.";

/** Alvo da tentativa no novo fluxo (principal/fallback) — mesmo literal do envelope (D-21). */
export type ImageGenerationFailureTarget = "primary" | "fallback";

/**
 * Diagnóstico **interno** correlacionado à referência (D-19). É o que fica
 * acessível apenas ao admin/suporte autenticado; nunca é exposto publicamente.
 */
export interface ImageGenerationInternalDiagnosis {
  reference: string;
  internalCategory: string;
  model: string;
  quality: string;
  target: ImageGenerationFailureTarget;
  attemptNumber: number;
  normalizedError: string;
  runId?: string;
  traceId?: string;
}

/**
 * Entrada do construtor/diagnóstico: os mesmos campos do diagnóstico interno, com
 * a referência **opcional** (quando ausente, uma referência nova é gerada).
 */
export type ImageGenerationDiagnosisInput = Omit<ImageGenerationInternalDiagnosis, "reference"> & {
  reference?: string;
};

/** Resposta pública devolvida ao lojista (código + referência + mensagem). */
export interface PublicGenerationFailure {
  code: typeof PUBLIC_GENERATION_FAILURE_CODE;
  reference: string;
  message: string;
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Gera a referência de atendimento opaca em UUID v4 (`crypto.randomUUID`, D-18). */
export function generateSupportReference(): string {
  return randomUUID();
}

/** `true` quando o valor é um UUID v4 no formato canônico. */
export function isSupportReference(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

/**
 * Constrói a resposta pública não reveladora (D-18/D-19): código público fixo
 * `IMG-001`, referência opaca (reutiliza a informada ou gera uma nova em UUID v4)
 * e mensagem PT-BR genérica sanitizada. Nunca inclui o texto cru do diagnóstico.
 */
export function buildPublicGenerationFailure(
  diagnosis: ImageGenerationDiagnosisInput,
): PublicGenerationFailure {
  const providedReference = diagnosis.reference?.trim();
  const reference = providedReference ? providedReference : generateSupportReference();

  return Object.freeze({
    code: PUBLIC_GENERATION_FAILURE_CODE,
    reference,
    message: sanitizeAiErrorMessage(PUBLIC_GENERATION_FAILURE_MESSAGE),
  });
}

/**
 * Sanitiza um texto do diagnóstico (mensagem pública) antes de persistir: remove
 * bearer, chaves `sk`/`AIza` e URLs (D-19). Continua usada para `message_public`.
 */
export function sanitizeDiagnosisText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return sanitizeAiErrorMessage(value);
}

/**
 * Normaliza o erro do diagnóstico para um código do conjunto FECHADO (D-19).
 *
 * Retorna o próprio `value` **se e somente se** ele já for um dos códigos de
 * `NORMALIZED_FAILURE_ERROR_CODES`; caso contrário devolve
 * `GENERIC_FAILURE_ERROR_CODE` (`unknown_provider_error`). NUNCA retorna nem
 * incorpora a entrada crua — é impossível persistir texto/chave/URL/stack do
 * provider por este caminho.
 */
export function normalizeDiagnosisErrorCode(
  value: string | null | undefined,
): NormalizedFailureErrorCode {
  if (typeof value === "string" && NORMALIZED_FAILURE_ERROR_CODE_SET.has(value)) {
    return value as NormalizedFailureErrorCode;
  }
  return GENERIC_FAILURE_ERROR_CODE;
}

/**
 * Materializa o diagnóstico interno (com referência definida) a partir de uma
 * entrada, normalizando o erro para um código do conjunto fechado (D-19).
 */
export function toInternalDiagnosis(
  diagnosis: ImageGenerationDiagnosisInput,
  reference: string,
): ImageGenerationInternalDiagnosis {
  return {
    reference,
    internalCategory: diagnosis.internalCategory,
    model: diagnosis.model,
    quality: diagnosis.quality,
    target: diagnosis.target,
    attemptNumber: diagnosis.attemptNumber,
    normalizedError: normalizeDiagnosisErrorCode(diagnosis.normalizedError),
    ...(diagnosis.runId !== undefined ? { runId: diagnosis.runId } : {}),
    ...(diagnosis.traceId !== undefined ? { traceId: diagnosis.traceId } : {}),
  };
}
