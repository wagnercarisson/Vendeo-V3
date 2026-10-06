/**
 * Política pura de falhas e fallback da geração de imagem do novo fluxo
 * (F56.1, D-15/D-16/D-17).
 *
 * Componente **puro** (sem provider, sem banco, sem crédito e sem I/O):
 *
 *  - **classifica** cada falha como **elegível** ou **não elegível** ao fallback
 *    (D-15), tratando sinais explícitos de quota/faturamento antes do `429`
 *    genérico (T-56.1-18);
 *  - decide a **próxima tentativa** respeitando o teto global de **3 chamadas**
 *    (≤2 no principal + ≤1 no fallback), com `rate_limit` transitório e
 *    disponibilidade indo direto ao fallback (D-16).
 *
 * Fronteira da fase (D-25): o componente é exercitado com erros **simulados**
 * (tasks 6.7/6.9) e **não** realiza nenhuma chamada real. O **enforcement
 * transacional** sobre o ledger de créditos (não-debito do lojista em falha
 * técnica) e a **aplicação** desta política sobre uma geração real são da
 * **F56.2**; aqui a regra contábil é **simulada** pelo resultado de encerramento
 * (`charged: false`/`consumedCredit: false`).
 */

import type { AiInvocationError, AiInvocationErrorKind } from "./types";

/** Categorias **fechadas** de falha da geração de imagem (D-15). */
export type ImageGenerationFailureClass =
  | "rate_limit"
  | "timeout"
  | "network"
  | "provider_error"
  | "availability"
  | "quota"
  | "billing"
  | "auth"
  | "content"
  | "input";

/** Classes **elegíveis** ao fallback (D-15) — as demais nunca acionam fallback. */
export const ELIGIBLE_IMAGE_GENERATION_FAILURE_CLASSES = Object.freeze([
  "rate_limit",
  "timeout",
  "network",
  "provider_error",
  "availability",
] as const);

/**
 * Forma mínima aceita pela classificação — `AiInvocationError` ou um objeto com
 * sinais parciais de um erro do provider. `status` é lido como sinônimo de
 * `httpStatus` para tolerar erros crus do SDK.
 */
export interface ImageGenerationFailureLike {
  kind?: AiInvocationErrorKind;
  code?: string;
  httpStatus?: number;
  message?: string;
}

/** Resultado determinístico da classificação: categoria + elegibilidade (D-15). */
export interface ImageGenerationFailureClassification {
  readonly category: ImageGenerationFailureClass;
  readonly eligibleForFallback: boolean;
}

/**
 * Sinais explícitos verificados antes do ramo genérico de `429` (T-56.1-18),
 * espelhando `normalizeAiError` em `types.ts` (plano 01) para consistência.
 */
const QUOTA_SIGNALS = ["insufficient_quota", "quota_exceeded"] as const;
const BILLING_SIGNALS = ["billing_hard_limit_reached", "account_deactivated", "billing"] as const;
const AUTH_SIGNALS = [
  "invalid_api_key",
  "incorrect api key",
  "invalid api key",
  "unauthorized",
  "authentication",
] as const;
const CONTENT_SIGNALS = ["content_filter", "content_policy", "content policy", "safety", "blocked"] as const;
const INPUT_SIGNALS = ["invalid_request", "invalid request", "validation", "bad request"] as const;
/** Disponibilidade/capacidade **explícita** do modelo (D-15/D-16). */
const AVAILABILITY_SIGNALS = ["overloaded", "unavailable", "capacity", "model_overloaded"] as const;
const NETWORK_SIGNALS = [
  "enotfound",
  "econnrefused",
  "econnreset",
  "etimedout",
  "fetch failed",
  "socket hang up",
  "network",
  "connection",
] as const;
const TIMEOUT_SIGNALS = ["timeout", "timed out"] as const;
const RATE_LIMIT_SIGNALS = ["rate_limit", "rate limit", "too many requests", "429"] as const;

function readStringField(error: unknown, field: string): string | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    typeof (error as Record<string, unknown>)[field] === "string"
  ) {
    return (error as Record<string, unknown>)[field] as string;
  }
  return undefined;
}

function readNumberField(error: unknown, field: string): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    typeof (error as Record<string, unknown>)[field] === "number"
  ) {
    return (error as Record<string, unknown>)[field] as number;
  }
  return undefined;
}

/** Lê `httpStatus` (contrato) com `status` como sinônimo de erros crus do SDK. */
function readHttpStatus(error: unknown): number | undefined {
  return readNumberField(error, "httpStatus") ?? readNumberField(error, "status");
}

function hasSignal(haystack: string, signals: readonly string[]): boolean {
  return signals.some((signal) => haystack.includes(signal));
}

/**
 * Classifica uma falha de geração como elegível/não elegível ao fallback (D-15).
 *
 * Determinístico e sem I/O. Sinais explícitos de quota e faturamento são
 * avaliados **antes** do `429` genérico — quota esgotada nunca vira `rate_limit`
 * transitório (T-56.1-18). Falhas de **entrada**, **autorização** e **segurança**
 * nunca retornam uma categoria de falha de **modelo** elegível.
 */
export function classifyImageGenerationFailure(
  error: AiInvocationError | ImageGenerationFailureLike,
): ImageGenerationFailureClassification {
  const source: unknown = error;
  const kind = readStringField(source, "kind") as AiInvocationErrorKind | undefined;
  const code = (readStringField(source, "code") ?? "").toLowerCase();
  const message = (readStringField(source, "message") ?? "").toLowerCase();
  const haystack = `${code} ${message}`;
  const httpStatus = readHttpStatus(source);

  const nonEligible = (category: ImageGenerationFailureClass): ImageGenerationFailureClassification =>
    Object.freeze({ category, eligibleForFallback: false });
  const eligible = (category: ImageGenerationFailureClass): ImageGenerationFailureClassification =>
    Object.freeze({ category, eligibleForFallback: true });

  // ── Não elegíveis (nunca acionam fallback) ────────────────────────────────
  // 1. Quota esgotada — ANTES do 429 genérico (T-56.1-18).
  if (kind === "quota" || hasSignal(haystack, QUOTA_SIGNALS)) return nonEligible("quota");
  // 2. Faturamento do provider.
  if (kind === "billing" || hasSignal(haystack, BILLING_SIGNALS)) return nonEligible("billing");
  // 3. Autenticação/autorização.
  if (kind === "auth" || httpStatus === 401 || httpStatus === 403 || hasSignal(haystack, AUTH_SIGNALS)) {
    return nonEligible("auth");
  }
  // 4. Conteúdo/segurança.
  if (kind === "content_filter" || hasSignal(haystack, CONTENT_SIGNALS)) return nonEligible("content");
  // 5. Entrada/validação e capacidade não suportada da requisição.
  if (kind === "capability" || hasSignal(haystack, INPUT_SIGNALS)) return nonEligible("input");

  // ── Elegíveis (podem acionar fallback) ────────────────────────────────────
  // 6. Disponibilidade/capacidade explícita do modelo.
  if (hasSignal(haystack, AVAILABILITY_SIGNALS)) return eligible("availability");
  // 7. rate_limit transitório.
  if (kind === "rate_limit" || httpStatus === 429 || hasSignal(haystack, RATE_LIMIT_SIGNALS)) {
    return eligible("rate_limit");
  }
  // 8. timeout.
  if (kind === "timeout" || httpStatus === 408 || httpStatus === 504 || hasSignal(haystack, TIMEOUT_SIGNALS)) {
    return eligible("timeout");
  }
  // 9. network.
  if (kind === "network" || hasSignal(haystack, NETWORK_SIGNALS)) return eligible("network");
  // 10. provider_error 5xx.
  if (httpStatus !== undefined && httpStatus >= 500) return eligible("provider_error");
  if (kind === "provider_error") {
    // Um `provider_error` explícito sem status é tratado como 5xx; um 4xx é
    // entrada/validação (`input`) — nunca elegível.
    return httpStatus === undefined ? eligible("provider_error") : nonEligible("input");
  }

  // 11. Default seguro: falha desconhecida não é tratada como falha de modelo.
  return nonEligible("input");
}

// ─── Política de execução (máquina de tentativas) ────────────────────────────

/** Alvo do par no novo fluxo (principal/fallback) — mesmo literal do envelope (D-21). */
export type ImageGenerationAttemptTarget = "primary" | "fallback";

/** Tetos da política (D-16): até 2 no principal + até 1 no fallback = até 3 chamadas. */
export const MAX_IMAGE_GENERATION_ATTEMPTS = 3;
export const MAX_PRIMARY_IMAGE_GENERATION_ATTEMPTS = 2;
export const MAX_FALLBACK_IMAGE_GENERATION_ATTEMPTS = 1;

/** Próxima ação da operação após uma falha classificada. */
export type ImageGenerationAttemptAction = "retry_primary" | "go_fallback" | "stop";

/** Estado da tentativa que acabou de falhar (alvo atual + número 1-based). */
export interface ImageGenerationAttemptState {
  readonly target: ImageGenerationAttemptTarget;
  readonly attemptNumber: number;
}

/**
 * Resultado puro da máquina de política. `charged`/`consumedCredit` são **sempre**
 * `false`: falha técnica não debita o lojista (D-17). A regra é **simulada**
 * nesta fase; o **enforcement transacional** sobre o ledger de créditos é da
 * **F56.2**.
 */
export interface ImageGenerationNextAttempt {
  readonly action: ImageGenerationAttemptAction;
  /** `true` quando a operação encerra (nenhuma nova tentativa). */
  readonly terminal: boolean;
  /** Alvo da próxima tentativa (ausente em `stop`). */
  readonly nextTarget?: ImageGenerationAttemptTarget;
  /** Número da próxima tentativa real, 1-based (ausente em `stop`). */
  readonly nextAttemptNumber?: number;
  /** D-17: falha técnica nunca cobra o lojista (regra simulada; enforcement = F56.2). */
  readonly charged: false;
  readonly consumedCredit: false;
}

/**
 * Plano máximo de tentativas da operação — invariante de teto (T-56.1-19):
 * até 2 no principal e até 1 no fallback, totalizando até 3 chamadas.
 */
export const IMAGE_GENERATION_ATTEMPT_PLAN: readonly ImageGenerationAttemptState[] = Object.freeze([
  Object.freeze({ target: "primary" as const, attemptNumber: 1 }),
  Object.freeze({ target: "primary" as const, attemptNumber: 2 }),
  Object.freeze({ target: "fallback" as const, attemptNumber: 3 }),
]);

/** Retorna o plano máximo de tentativas da operação (2 principal + 1 fallback). */
export function planImageGenerationAttempts(): readonly ImageGenerationAttemptState[] {
  return IMAGE_GENERATION_ATTEMPT_PLAN;
}

function isFailureClassification(
  value: ImageGenerationFailureClassification | AiInvocationError | ImageGenerationFailureLike,
): value is ImageGenerationFailureClassification {
  return (
    typeof value === "object" &&
    value !== null &&
    "category" in value &&
    "eligibleForFallback" in value
  );
}

function stopAttempt(): ImageGenerationNextAttempt {
  return Object.freeze({ action: "stop", terminal: true, charged: false, consumedCredit: false });
}

function continueAttempt(
  action: "retry_primary" | "go_fallback",
  nextTarget: ImageGenerationAttemptTarget,
  nextAttemptNumber: number,
): ImageGenerationNextAttempt {
  return Object.freeze({
    action,
    terminal: false,
    charged: false,
    consumedCredit: false,
    nextTarget,
    nextAttemptNumber,
  });
}

/**
 * Dado o estado da tentativa que falhou e a classificação da falha, devolve a
 * **próxima ação** da operação (D-16):
 *
 *  - falha **não elegível** (quota/billing/auth/content/input) → `stop`;
 *  - teto global de 3 chamadas atingido → `stop`;
 *  - fallback já utilizado → `stop`;
 *  - **disponibilidade/capacidade** explícita no principal → `go_fallback`
 *    direto, sem repetição inútil;
 *  - demais falhas elegíveis no principal → `retry_primary` (1ª tentativa) e
 *    `go_fallback` (2ª tentativa), cobrindo `rate_limit` transitório.
 */
export function nextImageGenerationAttempt(
  state: ImageGenerationAttemptState,
  failure: ImageGenerationFailureClassification | AiInvocationError | ImageGenerationFailureLike,
): ImageGenerationNextAttempt {
  const classification = isFailureClassification(failure)
    ? failure
    : classifyImageGenerationFailure(failure);

  if (!classification.eligibleForFallback) return stopAttempt();
  if (state.attemptNumber >= MAX_IMAGE_GENERATION_ATTEMPTS) return stopAttempt();
  if (state.target === "fallback") return stopAttempt();

  // state.target === "primary"
  if (classification.category === "availability") {
    // Disponibilidade/capacidade explícita não gasta repetição inútil no principal.
    return continueAttempt("go_fallback", "fallback", state.attemptNumber + 1);
  }
  if (state.attemptNumber < MAX_PRIMARY_IMAGE_GENERATION_ATTEMPTS) {
    return continueAttempt("retry_primary", "primary", state.attemptNumber + 1);
  }
  return continueAttempt("go_fallback", "fallback", state.attemptNumber + 1);
}
